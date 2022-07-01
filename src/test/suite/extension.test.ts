import * as path from 'path';
import * as fs from 'fs-extra';
import * as vscode from 'vscode';
import * as assert from 'assert'

import * as extension from '../../extension';
import * as odataMetadata from '../../odataMetadata';

suite("Metadata Tests", () => {

    const testsPath = path.resolve(__dirname, '../');
    const fixturesPath = path.join(testsPath, 'fixtures');

    test('Can parse', (done) => {
        fs.readFile(path.join(fixturesPath, 'metadata.xml'), { encoding: "utf8" })
            .then(content => {
                const parser = new odataMetadata.ODataMetadataParser();
                const metadata = parser.parse(content);
                assert.equal(metadata.schemas.length, 2)
            }).then(() => done(), done);
    });
});