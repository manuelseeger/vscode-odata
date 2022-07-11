import * as vscode from 'vscode';
import * as _ from 'lodash';

import { IODataMetadataService } from "./odataMetadata";
import * as syntax from "./odataSyntax";

import {
    TextDocument, Position, CompletionItem, CompletionList, CompletionItemKind, CancellationToken, ProviderResult
} from 'vscode';

export class ODataDefaultCompletionItemProvider implements vscode.CompletionItemProvider {
    triggerCharacters = [".", "=", ",", "(", "/", "'"];
    provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<CompletionList> {
        if (document.getWordRangeAtPosition(position, /\$[a-zA-Z]*/)) {
            return null;
        }
        if (document.getWordRangeAtPosition(position, /\$select=.*/)) {
            return null;
        }
        if (document.getWordRangeAtPosition(position, /\$inlinecount=.*/)) {
            return new CompletionList([new CompletionItem("allpages", CompletionItemKind.EnumMember)])
        }
        if (document.getWordRangeAtPosition(position, /\$format=.*/)) {
            return new CompletionList([
                new CompletionItem("json", CompletionItemKind.EnumMember),
                new CompletionItem("xml", CompletionItemKind.EnumMember)
            ])
        }

        let functions = [
            new CompletionItem("filter", CompletionItemKind.Function),
            new CompletionItem("groupby", CompletionItemKind.Function),
            new CompletionItem("aggregate", CompletionItemKind.Function),
            new CompletionItem("contains", CompletionItemKind.Function),
            new CompletionItem("startswith", CompletionItemKind.Function),
            new CompletionItem("endswith", CompletionItemKind.Function),
            new CompletionItem("datetimeoffset", CompletionItemKind.Function),
            new CompletionItem("datetime", CompletionItemKind.Function)
            // TODO: Add all functions
        ];
        return new CompletionList(functions);
    }
}

export class ODataSystemQueryCompletionItemProvider implements vscode.CompletionItemProvider {
    triggerCharacters = ["$"];
    provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<CompletionList> {
        if (document.getWordRangeAtPosition(position, /\$[a-zA-Z]*/)) {
            return new CompletionList([
                {
                    label: "$apply",
                    insertText: "apply",
                    filterText: "apply",
                    documentation: "Applies set transformations, separated by forward slashes.",
                    kind: CompletionItemKind.Keyword
                },
                {
                    label: "$filter",
                    insertText: "filter",
                    filterText: "filter",
                    documentation: "Filters collection of resources.",
                    kind: CompletionItemKind.Keyword
                },
                {
                    label: "$select",
                    insertText: "select",
                    filterText: "select",
                    documentation: "Selects a specific set of properties for each entity or complex type.",
                    kind: CompletionItemKind.Keyword
                },
                {
                    label: "$skip",
                    insertText: "skip",
                    filterText: "skip",
                    documentation: "Requests a number of items in the queried collection to be skipped and not included in the result.",
                    kind: CompletionItemKind.Keyword
                },
                {
                    label: "$top",
                    insertText: "top",
                    filterText: "top",
                    documentation: "Limits the number of items in the queried collection to be included in the result.",
                    kind: CompletionItemKind.Keyword
                },
                {
                    label: "$format",
                    insertText: "format",
                    filterText: "format",
                    documentation: "Requested format of the returned OData document (xml, json)",
                    kind: CompletionItemKind.Keyword
                },
                {
                    label: "$orderby",
                    insertText: "orderby",
                    filterText: "orderby",
                    documentation: "Perform an order-by on the provided property before selection",
                    kind: CompletionItemKind.Keyword
                },
                {
                    label: "$expand",
                    insertText: "expand",
                    filterText: "expand",
                    documentation: "Specifies the related resources or media streams to be included in line with retrieved resources",
                    kind: CompletionItemKind.Keyword
                },
                {
                    label: "$search",
                    insertText: "search",
                    filterText: "search",
                    documentation: "Allows clients to request items within a collection matching a free-text search expression",
                    kind: CompletionItemKind.Keyword
                },
                {
                    label: "$count",
                    insertText: "count",
                    filterText: "count",
                    documentation: "Allows clients to request a count of the matching resources included with the resources in the response",
                    kind: CompletionItemKind.Keyword
                },
                {
                    label: "$inlinecount",
                    insertText: "inlinecount",
                    filterText: "inlinecount",
                    documentation: "Indicates that the response to the request has to include the count of the number of entities in the EntitySet",
                    kind: CompletionItemKind.Keyword
                },
                {
                    label: "$skiptoken",
                    insertText: "skiptoken",
                    filterText: "skiptoken",
                    documentation: "Identifies a starting point in the collection of entities identified by the URI containing the $skiptoken parameter",
                    kind: CompletionItemKind.Keyword
                },
                {
                    label: "$compute",
                    insertText: "compute",
                    filterText: "compute",
                    documentation: "Allows clients to define computed properties that can be used in a $select or within a $filter or $orderby expression",
                    kind: CompletionItemKind.Keyword
                },
                {
                    label: "$schemaversion",
                    insertText: "schemaversion",
                    filterText: "schemaversion",
                    documentation: "The value specifies the version of the schema against which the request is made",
                    kind: CompletionItemKind.Keyword
                }
            ]);
        }
    }
}

export class ODataMetadataCompletionItemProvider implements vscode.CompletionItemProvider {
    triggerCharacters = [".", "=", ",", "(", "/", "'"];
    noMetadataCompletionOn = /\$(format|top|skip|count|skiptoken|compute|schemaversion|inlinecount)=.*/;
    metadataService: IODataMetadataService;

    constructor(metadataService: IODataMetadataService) {
        this.metadataService = metadataService;
    }

    provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<CompletionList> {
        try {
            if (document.getWordRangeAtPosition(position, this.noMetadataCompletionOn)) {
                return null;
            }
            let tree = syntax.Parser.parse(document.getText());
            let serviceRoot = tree.root.serviceRoot.toString();
            
            let mapEntry = this.metadataService.getMapEntry(serviceRoot);
            if (!mapEntry) {
                return null;
            }
            const metadata = this.metadataService.getMetadataDocument(serviceRoot);
            if (document.getWordRangeAtPosition(position, /\/[a-zA-Z]*/)) {
                // complete for entitysets
                let containerEntities =_.chain(metadata.schemas)
                    .flatMap(s => _.flatMap(s.entityContainers, c =>  _.flatMap(c.entitySets, e => e.name)))
                    .uniq()
                    .map(p => new CompletionItem(p, CompletionItemKind.Class))
                    .value();

                return new CompletionList(containerEntities);
            } 
            
            // complete for properties of entities found in the query document
            let entitySetTypeNames = metadata.getEntityContainerItems()
                                    .filter(es => document.getText().indexOf(es.name) > -1)
                                    .map(es => es.entityType.split('.').pop());

            let items = _.chain(metadata.schemas)
                .flatMap(s => _.flatMap(s.entityTypes))
                .filter(e => _.includes(entitySetTypeNames, e.name))
                .flatMap(e => e.properties.map(p => p.name))
                .uniq()
                .map(p => new CompletionItem(p, CompletionItemKind.Property))
                .value();

            return new CompletionList(items);
            
        } catch (error) {
            if (error instanceof syntax.SyntaxError) {
                let syntaxError = <syntax.SyntaxError>error;
                console.error(syntaxError.message);
            } else {
                console.error(error);
            }
        }
    }
}
