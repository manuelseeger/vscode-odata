import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as extension from '../../extension';

import { odataFormatUrl } from '../../odataCommands';

suite('OData Commands Tests', () => {
    
    const testsPath = path.resolve(__dirname, '../');
    const fixturesPath = path.join(testsPath, 'fixtures');

    const odataQueryDocument = `https://my555555-sso.crm.ondemand.com/sap/c4c/odata-sso/v1/customer/IndividualCustomerCollection?
    $filter=OwnerID eq '2341978'
    &$select=FirstName,LastName,CustomerID
    &$top=10
    &$format=json
    `
    let combinedUrl = `https://my555555-sso.crm.ondemand.com/sap/c4c/odata-sso/v1/customer/IndividualCustomerCollection?%24format=json&%24filter=OwnerID+eq+%272341978%27&%24select=FirstName%2CLastName%2CCustomerID&%24top=10`

    const northWindCombined = 'https://services.odata.org/V4/Northwind/Northwind.svc/Customers?%24expand=Orders%28%24select%3DOrderID%2CCustomerID%2CFreight%29&%24select=CompanyName%2CContactTitle%2CCustomerID&%24top=10&%24skip=10';

    test('Can Format Url', () => {
        assert.equal(odataFormatUrl(odataQueryDocument), combinedUrl)
    })

    test('Can run combine Url Command', async () => {
        const uri = vscode.Uri.file(path.join(fixturesPath, 'northwind.odata'));
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document);
        await sleep(200);
        vscode.commands.executeCommand("odata.combine");
        await sleep(1000);
        const combinedText = editor.document.getText();
        assert.equal(combinedText.trim(), northWindCombined)
        vscode.commands.executeCommand("workbench.action.closeActiveEditor");
    })
});

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
}