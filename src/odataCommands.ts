'use strict';

import * as vscode from 'vscode';
import { URL } from 'url';

import {
    TextDocument, Position, Range, TextEditorEdit, TextEditor
} from 'vscode';

import { ODataMode } from './odataMode';

export function odataCombine() {
    let editor = vscode.window.activeTextEditor;
    let document = editor.document;

    if (document.languageId !== ODataMode.language) {
        vscode.window.showInformationMessage('This command affects only OData files.');
    } else {
        try {
            let range = getActiveRange(editor);
            let text = editor.document.getText(range);
            let url = odataFormatUrl(text);
            editor.edit(edit => edit.replace(range, url));
        }
        catch (exception) {
            vscode.window.showWarningMessage('Document does not represent a valid URL.');
        }
    }
}

/**
 * Formats OData document with comments and line breaks as a valid url.
 * @param text - OData document.
 */
export function odataFormatUrl(text: string) {
    let urlText = text
        // Transform to lines.
        .split('\n')
        // Skip comments.
        .filter(t => !t.match(/^\s*\/\//))
        // Remove extra whitespaces and join into a single line.
        .map(t => t.trim())
        .filter(t => t != '')
        .join(' ')
        // Make sure there are no spaces in the fragment part or the URI.
        .replace(/\s+\?/, "?");

    // Make sure result is a valid URL.
    let url = new URL(urlText);

    // Make sure query parameters do not have leading or trailing whitespaces.
    for(let [key, value] of Array.from(url.searchParams)) {
        let keyClean = key.trim();
        let valueClean = value.trim();
        if (key.length != keyClean.length || value.length != valueClean.length) {
            url.searchParams.delete(key);
            url.searchParams.append(keyClean, valueClean);
        }        
    }
    return url.href;
}

export function odataDecode() {
    let editor = vscode.window.activeTextEditor;
    let range = getActiveRange(editor);
    let text = editor.document.getText(range);

    try {
        // Use decodeURIComponent instead of decodeURI to allow users to split
        // queries into multiple lines.
        text = decodeURI(text.replace(/\+/g, "%20"));
        editor.edit(edit => edit.replace(range, text));
    } catch (exception) {
        vscode.window.showWarningMessage(`Query could not be decoded. ${exception.message}.`);
    }
}

export function odataEncode() {
    let editor = vscode.window.activeTextEditor;
    let range = getActiveRange(editor);
    let text = editor.document.getText(range);

    text = encodeURI(text);

    editor.edit(edit => edit.replace(range, text));
}

export function odataEscape() {
    let editor = vscode.window.activeTextEditor;
    let range = getActiveRange(editor);
    let text = editor.document.getText(range);

    text = text
        .replace(/\\/g, "\\\\")
        .replace(/\n/g, "\\n")
        .replace(/\"/g, '\\"')
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");

    editor.edit(edit => edit.replace(range, text));
}

export function odataUnescape() {
    let editor = vscode.window.activeTextEditor;
    let range = getActiveRange(editor);
    let text = editor.document.getText(range);

    text = text
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '\"')
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\\\/g, "\\")
        .trim();

    editor.edit(edit => edit.replace(range, text));
}

export function odataOpen() {
    let editor = vscode.window.activeTextEditor;
    let document = editor.document;

    if (document.languageId !== ODataMode.language) {
        vscode.window.showInformationMessage('This command is availble only for OData files.');
    } else {
        try {
            let range = getActiveRange(editor);
            let text = document.getText(range);
            let url = odataFormatUrl(text);
            vscode.env.openExternal(vscode.Uri.parse(url))
        }
        catch (exception) {
            vscode.window.showWarningMessage('Document does not represent a valid URL.');
        }
    }
}

function getActiveRange(editor: TextEditor): Range {
    let selection = editor.selection;
    if (selection.isEmpty) {
        let firstLine = editor.document.lineAt(0);
        let lastLine = editor.document.lineAt(editor.document.lineCount - 1);
        return new Range(firstLine.range.start, lastLine.range.end);
    } else {
        return selection;
    }
}