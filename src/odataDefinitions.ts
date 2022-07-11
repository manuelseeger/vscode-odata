import * as vscode from 'vscode';
import * as _ from 'lodash';

import { IODataMetadataService } from "./odataMetadata";
import * as syntax from "./odataSyntax";
import internal = require('stream');

export class ODataDefinitionProvider implements vscode.DefinitionProvider {

    metadataService: IODataMetadataService;

    constructor(metadataService: IODataMetadataService) {
        this.metadataService = metadataService;
    }

    provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Definition | vscode.LocationLink[]> {
        let tree = syntax.Parser.parse(document.getText());
        let serviceRoot = tree.root.serviceRoot.toString();
        let mapEntry = this.metadataService.getMapEntry(serviceRoot);
        if (!mapEntry) {
            return null;
        }
        const range = document.getWordRangeAtPosition(position);
        const selectedEntityName = document.getText(range);
        const metadata = this.metadataService.getMetadataDocument(serviceRoot);
        const uri = vscode.Uri.file(mapEntry.path)
        const lines = this.metadataService.getMetadataDocumentLines(serviceRoot);

        if (document.getWordRangeAtPosition(position, /\/[a-zA-Z]*/)) {
            let entities = metadata.getEntityContainerItems()
                            .filter(es => es.name == selectedEntityName)

            return entities.flatMap(es => {
                let namespace = es.entityType.split('.')
                let entityType = namespace.pop()
                let rows = lines.map((line, i) => [line.indexOf(`<EntityType Name="${entityType}"`),i])
                                            .filter(r => r[0] >= 0)
                return rows.map(r => new vscode.Location(uri, new vscode.Position(r[1], r[0])))
            })
        }

        const properties = _.uniqBy(metadata.getProperties(), p => p.name);
        let propertyLocations = properties.filter(p => p.name == selectedEntityName)
                    .flatMap(p => lines.map((line, i) => [line.indexOf(`<Property Name="${p.name}"`),i])
                                                    .filter(r => r[0] >= 0))
                    .map(pos => new vscode.Location(uri, new vscode.Position(pos[1], pos[0])))
        return propertyLocations;
    }
}
