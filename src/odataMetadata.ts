import { XmlDocument, XmlElement } from 'xmldoc';
import * as fs from 'fs-extra';
import * as path from 'path'
import * as vscode from 'vscode';
import * as _ from 'lodash';

export interface ODataMetadataConfiguration {
    map: Array<IODataMetadataConfigurationMapEntry>;
}

export interface IODataMetadataConfigurationMapEntry {
    url: string, 
    path: string
}

export interface IODataMetadataService {
    getMetadataDocument(serviceRoot: string): IMetadata;
    hasMapEntry(serviceRoot: string): boolean;
    getMapEntry(serviceRoot: string): IODataMetadataConfigurationMapEntry;
    getMetadataDocumentLines(serviceRoot: string): string[];
}

export interface IMetadata {
    schemas?: ISchema[];
    getProperties(): IProperty[];
    getEntityContainerItems(): IEntitySet[];
}

export interface IEntityType {
    name: string;
    key?: IPropertyRef[];
    properties?: IProperty[];
}

export interface ICacheEntry {
    lines: Array<string>;
    metadata: IMetadata;
}

export interface IPropertyRef {
    name: string;
}

export interface IProperty {
    name: string;
    type: string;
    nullable?: boolean;
    annotations?: IAnnotation[];
    attr?: {string: string}
}

export interface INavigationProperty {
    name: string;
    type: string;
    referentialConstraints?: IReferentialConstraint[];
}

export interface IReferentialConstraint {
    property: string;
    referencedProperty: string;
}

export interface IEntityContainer {
    name: string;
    entitySets?: IEntitySet[];
}

export interface IEntitySet {
    name: string;
    entityType: string;
    navigationPropertyBindings?: INavigationPropertyBinding[];
    annotations?: IAnnotation[];
}

export interface INavigationPropertyBinding {
    path: string;
    target: string;
}

export interface IAnnotation {
    term: string;
    value: any;
}

export interface ISchema {
    namespace: string;
    entityTypes?: IEntityType[];
    entityContainers?: IEntityContainer[];
}


function getChildOrProperty(element: XmlElement, nodeName: string): string {
    if (element.attr[nodeName]) {
        return element.attr[nodeName];
    } else {
        return element.valueWithPath(nodeName);
    }
}

class Metadata implements IMetadata {
    schemas?: ISchema[];

    constructor(schemas?: ISchema[]) {
        this.schemas = schemas;
    }

    getEntityContainerItems(): IEntitySet[] {
        let containerEntities = _.chain(this.schemas)
            .flatMap(s => _.flatMap(s.entityContainers, c =>  _.flatMap(c.entitySets)))
            .uniq()
            .value();
        return containerEntities;
    }

    getProperties(): IProperty[] {
        let items = _.chain(this.schemas)
                    .flatMap(s => _.flatMap(s.entityTypes))
                    .flatMap(e => e.properties)
                    .uniq()
                    .value();
        return items;
    }    
}

export class ODataMetadataParser {

    parse(text: string): IMetadata {
        return this.parseDocument(new XmlDocument(text));
    }

    parseDocument(document: XmlDocument): IMetadata {
        let dataServices = document.childNamed("edmx:DataServices");
        return new Metadata(this.parseCollection(dataServices, "Schema", (e) => this.parseSchema(e)))
    }

    parseSchema(element: XmlElement): ISchema {
        return <ISchema>{
            namespace: getChildOrProperty(element, "Namespace"),
            entityTypes: this.parseCollection<IEntityType>(element, "EntityType", (e) => this.parseEntityType(e)),
            entityContainers: this.parseCollection<IEntityContainer>(element, "EntityContainer", (e) => this.parseEntityContainer(e))
        }
    }

    parseEntityContainer(element: XmlElement): IEntityContainer {
        return <IEntityContainer>{
            name: getChildOrProperty(element, "Name"),
            entitySets: this.parseCollection<IEntitySet>(element, "EntitySet", (e) => this.parseEntitySet(e))
        }
    }

    parseEntitySet(element: XmlElement): IEntitySet {
        return <IEntitySet>{
            name: getChildOrProperty(element, "Name"),
            entityType: getChildOrProperty(element, "EntityType"),
            navigationPropertyBindings: this.parseCollection<INavigationPropertyBinding>(element, "NavigationPropertyBinding", (e) => this.parseNavigationPropertyBinding(e)),
            annotations: this.parseCollection(element, "Annotation", (e) => this.parseAnnotation(e))
        }
    }

    parseNavigationPropertyBinding(element: XmlElement): INavigationPropertyBinding {
        return <INavigationPropertyBinding>{
            path: getChildOrProperty(element, "Path"),
            target: getChildOrProperty(element, "Target")
        }
    }

    parseEntityType(element: XmlElement): IEntityType {
        return <IEntityType>{
            name: getChildOrProperty(element, "Name"),
            properties: this.parseCollection<IProperty>(element, "Property", (e) => this.parseProperty(e))
        }
    }

    parseProperty(element: XmlElement): IProperty {
        return <IProperty>{
            name: getChildOrProperty(element, "Name"),
            type: getChildOrProperty(element, "Type"),
            nullable: getChildOrProperty(element, "Nullable") ? !!getChildOrProperty(element, "Nullable") : undefined,
            annotations: this.parseCollection(element, "Annotation", (e) => this.parseAnnotation(e)),
            attr: element.attr
        };
    }

    parseAnnotation(element: XmlElement): IAnnotation {
        // TODO: support different types of annotations
        return <IAnnotation>{
            term: element.valueWithPath("Term"),
            value: element.valueWithPath("String")
        }
    }

    parseCollection<T>(element: XmlElement, name: string, select: (element: XmlElement) => T) {
        let nodes = element.childrenNamed(name);
        let result = new Array<T>();

        for (let i = 0; i < nodes.length; i++) {
            result.push(select(nodes[i]));
        }

        return result.length > 0 ? result : undefined;
    }
}

export function createPropertyMap(metadata: IMetadata): { [id: string]: IProperty; } {
    return metadata.schemas
        .reduce<IEntityType[]>(
        (acc, schema) => { return <IEntityType[]>(schema.entityTypes ? acc.concat(schema.entityTypes) : acc); },
        new Array<IEntityType>()
        )
        .filter((entityType) => {
            return entityType.name === "WorkItem" || entityType.name === "CustomWorkItem";
        })
        .reduce<IProperty[]>(
        (acc, x) => { return <IProperty[]>(x.properties ? acc.concat(x.properties) : acc); },
        new Array<IProperty>()
        )
        .map((p) => {
            let referenceName = p.annotations
                ? p.annotations
                    .filter((a) => { return a.term === "Ref.ReferenceName" })
                    .map((a) => { return a.value as string; })[0]
                : undefined;

            return { referenceName: referenceName, property: p };
        })
        .filter((x) => {
            return x.referenceName !== undefined;
        })
        .reduce<{ [id: string]: IProperty; }>(
        (acc, x) => { acc[x.referenceName] = x.property; return acc; },
        {}
        );
}

export class LocalODataMetadataService implements IODataMetadataService {
    configuration: ODataMetadataConfiguration;
    cache: { [key: string]: ICacheEntry } = {};
    

    constructor(configuration: ODataMetadataConfiguration) {
        this.configuration = configuration;
    }

    getMetadataPath(configurationMapEntry: IODataMetadataConfigurationMapEntry): string {
        if (path.isAbsolute(configurationMapEntry.path)) {
            return configurationMapEntry.path;
        } else {
            if (vscode.workspace.workspaceFolders[0]) {
                return path.join(vscode.workspace.workspaceFolders[0].toString(), configurationMapEntry.path);
            } else {
                return configurationMapEntry.path;
            }
        }
    }

    hasMapEntry(serviceRoot: string): boolean {
        return !!this.configuration.map.find(m => serviceRoot.toLowerCase().startsWith(m.url.toLowerCase()));
    }

    getMapEntry(serviceRoot: string): IODataMetadataConfigurationMapEntry {
        return this.configuration.map.find(m => serviceRoot.toLowerCase().startsWith(m.url.toLowerCase()));
    }

    getMetadataDocumentLines(serviceRoot: string): string[] {
        let mapEntry = this.getMapEntry(serviceRoot);
        if (mapEntry) {
            if (this.cache[mapEntry.path] === undefined) {
                let metadataPath = this.getMetadataPath(mapEntry);
                let metadataFile = fs.readFileSync(metadataPath, { encoding: "utf8" });

                this.cache[mapEntry.path] = {
                    metadata: new ODataMetadataParser().parse(metadataFile),
                    lines: metadataFile.split('\n')
                }
            }
            return this.cache[mapEntry.path].lines
        }
    }

    getMetadataDocument(serviceRoot: string): IMetadata {
        let mapEntry = this.getMapEntry(serviceRoot);
        if (mapEntry) {
            if (this.cache[mapEntry.path] === undefined) {
                let metadataPath = this.getMetadataPath(mapEntry);
                let metadatFile = fs.readFileSync(metadataPath, { encoding: "utf8" });

                this.cache[mapEntry.path] = {
                    metadata: new ODataMetadataParser().parse(metadatFile),
                    lines: metadatFile.split('\n')
                }
            }
            return this.cache[mapEntry.path].metadata;
        }
    }
}
