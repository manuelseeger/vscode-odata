import * as vscode from 'vscode';
import * as _ from 'lodash';

import { IODataMetadataService } from "./odataMetadata";
import * as syntax from "./odataSyntax";

import {
    Definition, Location, CompletionItem, CompletionList, CompletionItemKind, CancellationToken, ProviderResult, DefinitionProvider
} from 'vscode';


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

        if (document.getWordRangeAtPosition(position, /\/[a-zA-Z]*/)) {
            let range = document.getWordRangeAtPosition(position);
            let selectedEntityName = document.getText(range);
            let metadata = this.metadataService.getMetadataForDocument(tree);
            let lines = this.metadataService.getMetadataDocumentLines(tree);
            let uri = vscode.Uri.file(mapEntry.path)

            let entities = _.chain(metadata.schemas)
                            .flatMap(s => _.flatMap(s.entityContainers, c =>  _.flatMap(c.entitySets)))
                            .filter(es => es.name == selectedEntityName)

            return entities.flatMap(es => {
                let entityType;
                if (es.entityType.indexOf('.') >= 0) {
                    entityType = es.entityType.split('.')[1];
                } else {
                    entityType = es.entityType;
                }
                let rows = lines.map((l, i) => [l.indexOf(`<EntityType Name="${entityType}"`),i])
                                            .filter(r => r[0] >= 0)
                return rows.map(r => new Location(uri, new vscode.Position(r[1], r[0])))
            }).value()
        }
    }
}
