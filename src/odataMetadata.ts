import { XmlDocument, XmlElement } from 'xmldoc';
import * as Syntax from './odataSyntax'
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
    getMetadataForDocument(tree: Syntax.SyntaxTree): IMetadata;
    hasMapEntry(tree: Syntax.SyntaxTree): boolean;
    getEntityContainerItems(metadata: IMetadata): IEntitySet[];
    getMapEntry(tree: Syntax.SyntaxTree): IODataMetadataConfigurationMapEntry;
    getMetadataDocumentLines(tree: Syntax.SyntaxTree): string[];
}

export interface IEntityType {
    name: string;
    key?: IPropertyRef[];
    properties?: IProperty[];
}

export interface IMapEntry {
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

export interface IMetadata {
    schemas?: ISchema[];
}

function getChildOrProperty(element: XmlElement, nodeName: string): string {
    if (element.attr[nodeName]) {
        return element.attr[nodeName];
    } else {
        return element.valueWithPath(nodeName);
    }
}

export class ODataMetadataParser {

    parse(text: string): IMetadata {
        return this.parseDocument(new XmlDocument(text));
    }

    parseDocument(document: XmlDocument): IMetadata {
        let dataServices = document.childNamed("edmx:DataServices");
        return <IMetadata>{
            schemas: this.parseCollection(dataServices, "Schema", (e) => this.parseSchema(e))
        };
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
            path: element.valueWithPath("Path"),
            target: element.valueWithPath("Target")
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
            nullable: element.valueWithPath("Nullable") ? !!element.valueWithPath("Nullable") : undefined,
            annotations: this.parseCollection(element, "Annotation", (e) => this.parseAnnotation(e))
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
    cache: { [key: string]: IMapEntry } = {};
    

    constructor(configuration: ODataMetadataConfiguration) {
        this.configuration = configuration;
    }

    getEntityContainerItems(metadata: IMetadata): IEntitySet[] {
        let containerEntities = _.chain(metadata.schemas)
            .flatMap(s => _.flatMap(s.entityContainers, c =>  _.flatMap(c.entitySets, e => e.name)))
            .uniq();
        return null;
    }

    getMetadataPath(mapEntry): string {
        return path.isAbsolute(mapEntry.path)
                ? mapEntry.path
                : vscode.workspace.workspaceFolders[0]
                ? path.join(vscode.workspace.workspaceFolders[0].toString(), mapEntry.path)
                : mapEntry.path;
    }

    hasMapEntry(tree: Syntax.SyntaxTree): boolean {
        let serviceRoot = tree.root.serviceRoot.toLowerCase();
        return !!this.configuration.map.find(m => serviceRoot.startsWith(m.url.toLowerCase()));
    }

    getMapEntry(tree: Syntax.SyntaxTree): IODataMetadataConfigurationMapEntry {
        let serviceRoot = tree.root.serviceRoot.toLowerCase();
        return this.configuration.map.find(m => serviceRoot.startsWith(m.url.toLowerCase()));
    }

    getMetadataDocumentLines(tree: Syntax.SyntaxTree): string[] {
        let mapEntry = this.getMapEntry(tree);
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

    getMetadataForDocument(tree: Syntax.SyntaxTree): IMetadata {
        let mapEntry = this.getMapEntry(tree);
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
