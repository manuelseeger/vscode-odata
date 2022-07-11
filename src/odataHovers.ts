import * as vscode from 'vscode';
import * as _ from 'lodash';

import { IODataMetadataService } from "./odataMetadata";
import * as syntax from "./odataSyntax";

export class ODataHoverProvider implements vscode.HoverProvider {
    
    metadataService: IODataMetadataService;

    constructor(metadataService: IODataMetadataService) {
        this.metadataService = metadataService;
    }

    provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
        let tree = syntax.Parser.parse(document.getText());
        let serviceRoot = tree.root.serviceRoot.toString();
        let mapEntry = this.metadataService.getMapEntry(serviceRoot);
        if (!mapEntry) {
            return null;
        }

        const range = document.getWordRangeAtPosition(position);
        const selectedEntityName = document.getText(range);

        const metadata = this.metadataService.getMetadataDocument(serviceRoot);

        let entitySet = _.find(metadata.getEntityContainerItems(),
                            { name: selectedEntityName})
        
        if (entitySet) {
            let namespace = entitySet.entityType.split('.')
            let entityType = namespace.pop()

            let properties = _.chain(metadata.schemas)
                .flatMap(s => _.flatMap(s.entityTypes))
                .filter(e => e.name == entityType)
                .flatMap(e => e.properties)
                .slice(0, 10)
                .map(p => `- ${p.name}: ${p.type}`)
                .value()
                .join('\n')

            return new vscode.Hover(new vscode.MarkdownString(
`**EntitySet**: ${entitySet.name}

- EntityType: ${entityType}
- Namespace: ${namespace}

Properties: 

${properties}
`));
        }
    }
}