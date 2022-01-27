const express = require('express');
const app = express();
const algosdk = require('algosdk');
const denv = require('dotenv');
denv.config();

app.use(express.json());

//#region initial setup

//this is important to get current blockchain info to use in the transaction 
//such as fee, genesisID, genesis Hash etc. and sending it to 
//the network after creating the transaction

const baseServer = process.env.BASE_SERVER;
const alogPort = '';
const token = {
    'X-API-Key': process.env.API_KEY
}
const algodClient = new algosdk.Algodv2(token, baseServer, alogPort);
//#endregion

//Generates Algorand Address
app.get('/api/generateAlgoAddress/', async (req, res) => {
    const account = await algosdk.generateAccount();
    let mnemonic = algosdk.secretKeyToMnemonic(account.sk);
    let secretKey = Buffer.from(account.sk).toString('base64');
    let responseString = 'Here is your Algo address: "' + account.addr + 
        '" \n And the Mnemonic: "' + mnemonic + '" ' + 
        ' \n And the Secret Key: ' + secretKey;
    res.send(responseString);
});

//Gets Balannce of an Address
app.get('/api/getBalance/:address', async (req, res) => {
    let address = req.params.address;

    let accountInfo = await algodClient.accountInformation(address).do();
    let responseString = "Account balance: " + accountInfo.amount + " microAlgos";

    res.send(responseString);
});

//creates algorand transaction and broadcast it to testnet. Parameters=> receiverAddress:String, amount:Integer
app.post('/api/createAlgoTrx/', async (req, res) => {
    let receiverAddress = req.body.receiverAddress;
    let amountInMicroAlgo = req.body.amount;

    const mnemonic = process.env.SENDER_MNEMONIC;
    const recoveredAccount = algosdk.mnemonicToSecretKey(mnemonic);

    let params = await algodClient.getTransactionParams().do();

    var enc = new TextEncoder();
    let note = enc.encode("This is a sample Algorand transaction with the amount of " + amountInMicroAlgo);
    
    //create transaction object. Please note that amount should be in microAlgos
    let txn = {
        "from": recoveredAccount.addr,
        "to": receiverAddress,
        "amount": amountInMicroAlgo,
        "fee": params.fee,
        "firstRound": params.firstRound,
        "lastRound": params.lastRound,
        "genesisID": params.genesisID,
        "genesisHash": params.genesisHash,
        "note": note,// new Uint8Array(0),
    };    

    //sign the transaction with sender's secret key
    const signedTxn = algosdk.signTransaction(txn, recoveredAccount.sk);

    //publish transaction to testnet with algoClient via the algorand API
    const sendTx = await algodClient.sendRawTransaction(signedTxn.blob).do();

    //waiting for the transaction confirmation
    waitForConfirmation(algodClient, sendTx.txId)
        
    //return transaction ID. It can be checked on algorand testnet explorer (https://testnet.algoexplorer.io/)
    let responseString = 'Transaction sent with ID ' + sendTx.txId;
    res.send(responseString);
});

//re-generates an Algorand Address from a known mnemonic
app.post('/api/regenerateAlgoAddressWithMnemonic/', async (req, res) => {
    let mnemonic = req.body.mnemonic;

    const recoveredAccount = algosdk.mnemonicToSecretKey(mnemonic);

    let responseString = 'Regenerated Algo Address is: ' + recoveredAccount.addr;
    res.send(responseString);
});

//re-generates an Algorand Address from a known secret key
app.post('/api/regenerateAlgoAddressWithSK/', async (req, res) => {
    let secretKey = req.body.secretKey;
    let mnemonic = algosdk.secretKeyToMnemonic(Buffer.from(secretKey, 'base64'))

    const recoveredAccount = algosdk.mnemonicToSecretKey(mnemonic);

    let responseString = 'Regenerated Algo Address is: ' + recoveredAccount.addr;
    res.send(responseString);
});


app.get('/', (req, res) => {
    res.send('This is a test Algo API');
});

const port = 3000;
app.listen(port, () => console.log(`Listening on port ${port}`));

const waitForConfirmation = async function (algodClient, txId) {
    let lastround = (await algodClient.status().do())['last-round'];
     while (true) {
        const pendingInfo = await algodClient.pendingTransactionInformation(txId).do();
        if (pendingInfo['confirmed-round'] !== null && pendingInfo['confirmed-round'] > 0) {
          //Got the completed Transaction
          console.log('Transaction confirmed in round ' + pendingInfo['confirmed-round']);
          break;
        }
        lastround++;
        await algodClient.statusAfterBlock(lastround).do();
     }
 };