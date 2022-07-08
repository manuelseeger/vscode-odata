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
        let mapEntry = this.metadataService.getMapEntry(tree);
        if (!mapEntry) {
            return null;
        }
        const range = document.getWordRangeAtPosition(position);
        const selectedEntityName = document.getText(range);
        const metadata = this.metadataService.getMetadataForDocument(tree);
        const uri = vscode.Uri.file(mapEntry.path)
        const lines = this.metadataService.getMetadataDocumentLines(tree);

        if (document.getWordRangeAtPosition(position, /\/[a-zA-Z]*/)) {
            let entities = this.metadataService.getEntityContainerItems(metadata)
                            .filter(es => es.name == selectedEntityName)

            return entities.flatMap(es => {
                let namespace = es.entityType.split('.')
                let entityType = namespace.pop()
                let rows = lines.map((l, i) => [l.indexOf(`<EntityType Name="${entityType}"`),i])
                                            .filter(r => r[0] >= 0)
                return rows.map(r => new vscode.Location(uri, new vscode.Position(r[1], r[0])))
            })
        }

        const properties = _.uniqBy(this.metadataService.getProperties(metadata), p => p.name);
        let propertyLocations = properties.filter(p => p.name == selectedEntityName)
                    .flatMap(p => lines.map((l, i) => [l.indexOf(`<Property Name="${p.name}"`),i])
                                                    .filter(r => r[0] >= 0))
                    .map(pos => new vscode.Location(uri, new vscode.Position(pos[1], pos[0])))
        return propertyLocations;
    }
}
