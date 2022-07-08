'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as _ from 'lodash';

import { ODataMode } from './odataMode';
import { ODataDiagnosticProvider } from './odataDiagnostic';
import { ODataDocumentFormattingEditProvider, ODataFormattingConfiguration } from "./odataFormatter";
import { LocalODataMetadataService, ODataMetadataConfiguration } from "./odataMetadata";
import { ODataDefinitionProvider } from "./odataDefinitions";
import { odataCombine, odataDecode, odataEncode, odataEscape, odataUnescape, odataOpen } from "./odataCommands";
import {    
    ODataDefaultCompletionItemProvider, ODataMetadataCompletionItemProvider, 
    ODataSystemQueryCompletionItemProvider 
} from './odataCompletions'

interface ODataConfiguration extends vscode.WorkspaceConfiguration {
    diagnostic: {
        enable: boolean;
    };
    format: ODataFormattingConfiguration;
    metadata: ODataMetadataConfiguration;
}

export function activate(context: vscode.ExtensionContext) {

    console.log('Extension "vscode-odata" is now active');

    let configuration = vscode.workspace.getConfiguration('odata') as ODataConfiguration;

    // The command has been defined in the package.json file
    context.subscriptions.push(vscode.commands.registerCommand('odata.combine', odataCombine));
    context.subscriptions.push(vscode.commands.registerCommand('odata.decode', odataDecode));
    context.subscriptions.push(vscode.commands.registerCommand('odata.encode', odataEncode));
    context.subscriptions.push(vscode.commands.registerCommand('odata.escape', odataEscape));
    context.subscriptions.push(vscode.commands.registerCommand('odata.unescape', odataUnescape));
    context.subscriptions.push(vscode.commands.registerCommand('odata.open', odataOpen));
    
    const systemQueryCompleteProvider = new ODataSystemQueryCompletionItemProvider()
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(ODataMode, 
        systemQueryCompleteProvider, ...systemQueryCompleteProvider.triggerCharacters))
    
    const defaultCompleteProvider = new ODataDefaultCompletionItemProvider()
        context.subscriptions.push(vscode.languages.registerCompletionItemProvider(ODataMode, 
            defaultCompleteProvider, ...defaultCompleteProvider.triggerCharacters))
    
    if (configuration.metadata.map && configuration.metadata.map.length > 0) {
        let metadataService = new LocalODataMetadataService(configuration.metadata);
        let metadataCompletionItemProvider = new ODataMetadataCompletionItemProvider(metadataService);
        context.subscriptions.push(vscode.languages.registerCompletionItemProvider(ODataMode,
            metadataCompletionItemProvider, ...metadataCompletionItemProvider.triggerCharacters));

        let metadataDefinitionsProvider = new ODataDefinitionProvider(metadataService);
        context.subscriptions.push(vscode.languages.registerDefinitionProvider(ODataMode, metadataDefinitionsProvider));
    }

    if (configuration.format.enable) {
        let documentFormattingEditProvider = new ODataDocumentFormattingEditProvider(configuration.format);
        context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(ODataMode,
            documentFormattingEditProvider));
    }

    if (configuration.diagnostic.enable) {
        let diagnosticCollection = vscode.languages.createDiagnosticCollection('odata-diagnostics');
        let diagnosticsProvider = new ODataDiagnosticProvider(diagnosticCollection);
        vscode.workspace.onDidChangeTextDocument(diagnosticsProvider.onDidChangeTextDocument, null, context.subscriptions);
    }
}

export function deactivate() {
}