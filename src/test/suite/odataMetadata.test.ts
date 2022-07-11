import * as path from 'path';
import * as assert from 'assert'
import * as odataMetadata from '../../odataMetadata';

suite("Metadata Tests", () => {

    const testsPath = path.resolve(__dirname, '../');
    const fixturesPath = path.join(testsPath, 'fixtures');

    let configuration = <odataMetadata.ODataMetadataConfiguration>{
        map: [
            {
                url: 'https://services.odata.org/Experimental/Northwind/Northwind.svc',
                path: path.join(fixturesPath, 'northwind$metadata.xml')
            },
            {
                url: 'https://sandbox.api.sap.com/s4hanacloud/sap/opu/odata/sap/API_BUSINESS_PARTNER',
                path: path.join(fixturesPath, 's4bp$metadata.xml')
            }
        ]
    };

    const metadataService = new odataMetadata.LocalODataMetadataService(configuration);

    test('Can parse Northwind', (done) => {
        const metadata = metadataService.getMetadataDocument('https://services.odata.org/Experimental/Northwind/Northwind.svc');
        const containerEntities = metadata.getEntityContainerItems();
        assert.equal(containerEntities.length, 26);
        assert.ok(containerEntities.find(c => c.name == 'CustomerDemographics'));
        assert.ok(containerEntities.find(c => c.name == 'Category_Sales_for_1997'));
        done();
    });

    test('Can parse S4 BP', (done) => {
        const metadata = metadataService.getMetadataDocument('https://sandbox.api.sap.com/s4hanacloud/sap/opu/odata/sap/API_BUSINESS_PARTNER');
        const containerEntities = metadata.getEntityContainerItems();
        assert.equal(containerEntities.length, 36);
        assert.ok(containerEntities.find(c => c.name == 'A_BusinessPartnerBank'));
        done();
    });
});
