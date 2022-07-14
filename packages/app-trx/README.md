[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lerna.js.org/)
[![view on npm](https://badgen.net/npm/v/@secux/app-trx)](https://www.npmjs.com/package/@secux/app-trx)
[![npm module downloads](https://badgen.net/npm/dt/@secux/app-trx)](https://www.npmjs.org/package/@secux/app-trx)

# `@secux/app-trx`

> SecuX Hardware Wallet TRX API

## Usage

```ts
import { SecuxTRX } from "@secux/app-trx";
```

First, create instance of ITransport
- [Web Usb](https://www.npmjs.com/package/@secux/transport-webusb)
- [Web Bluetooth](https://www.npmjs.com/package/@secux/transport-webble)
- [React Native Bluetooth](https://www.npmjs.com/package/@secux/transport-reactnative)

<br/>

## Examples
1. Get address of bip44 path
```ts
const path = "m/44'/195'/0'/0/0";
const address = await device.getAddress(path);

/*

// transfer data to hardware wallet by custom transport layer.
const data = SecuxTRX.prepareAddress(path);
const response = await device.Exchange(data);
const address =  SecuxTRX.resolveAddress(response);

*/
```

2. Sign transaction (TransferContract)
```ts
const TronWeb = require("tronweb");

// fetch block data
const tronWeb = new TronWeb({ fullHost: 'https://api.trongrid.io' });
const block = await tronWeb.trx.getConfirmedCurrentBlock();

const content = {
    to: "TJKiYicrKqB7PR2wywfWKkNMppNRqd6tXt",
    amount: 1e5,
    blockID: block.blockID,
    blockNumber: block.block_header.raw_data.number,
    timestamp: block.block_header.raw_data.timestamp
};

// sign
const { raw_tx, signature } = await device.sign("m/44'/195'/0'/0/0", content);

/*

// transfer data to hardware wallet by custom transport layer.
const { commandData, rawTx } = SecuxTRX.prepareSign("m/44'/195'/0'/0/0", content);
const response = await device.Exchange(commandData);
const raw_tx = SecuxTRX.resolveTransaction(response, rawTx);

*/

// broadcast
const response = await tronWeb.trx.sendHexTransaction(raw_tx);
```

3. Sign TRC10 transaction (TransferAssetContract)
```ts
const content = {
    to: "TJKiYicrKqB7PR2wywfWKkNMppNRqd6tXt",
    token: 1002000,
    amount: 1e5,
    blockID: block.blockID,
    blockNumber: block.block_header.raw_data.number,
    timestamp: block.block_header.raw_data.timestamp
};

const { raw_tx, signature } = await device.sign("m/44'/195'/0'/0/0", content);

/*

// transfer data to hardware wallet by custom transport layer.
const { commandData, rawTx } = SecuxTRX.prepareSign("m/44'/195'/0'/0/0", content);
const response = await device.Exchange(commandData);
const raw_tx = SecuxTRX.resolveTransaction(response, rawTx);

*/
```

4. Sign TRC20 transaction (TriggerSmartContract)
   * \[tokenId\]: the TRC10 asset ID that transfered to the contract while calling the contract.
   * \[tokenValue\]: the amount of TRC10 asset that transfered to the contract while calling the contract.
   * \[callValue\]: the amount of TRX that transfered to the contract while calling the contract, the unit is sun.
```ts
const content = {
    contract: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    // data field can use abi encoded string optionally
    data: [
        { type: "address", value: "TJKiYicrKqB7PR2wywfWKkNMppNRqd6tXt" },
        { type: "uint256", value: 1e5 }
    ],
    blockID: block.blockID,
    blockNumber: block.block_header.raw_data.number,
    timestamp: block.block_header.raw_data.timestamp
};

const { raw_tx, signature } = await device.sign("m/44'/195'/0'/0/0", content);

/*

// transfer data to hardware wallet by custom transport layer.
const { commandData, rawTx } = SecuxTRX.prepareSign("m/44'/195'/0'/0/0", content);
const response = await device.Exchange(commandData);
const raw_tx = SecuxTRX.resolveTransaction(response, rawTx);

*/
```

# API Reference
TRX package for SecuX device

**Kind**: global class  

* [SecuxTRX](#SecuxTRX)
    * [.addressConvert(publickey)](#SecuxTRX.addressConvert) ⇒ <code>string</code>
    * [.toHexAddress(address)](#SecuxTRX.toHexAddress) ⇒ <code>string</code>
    * [.prepareAddress(path)](#SecuxTRX.prepareAddress) ⇒ [<code>communicationData</code>](#communicationData)
    * [.resolveAddress(response)](#SecuxTRX.resolveAddress) ⇒ <code>string</code>
    * [.preparePublickey(path)](#SecuxTRX.preparePublickey) ⇒ [<code>communicationData</code>](#communicationData)
    * [.resolvePublickey(response)](#SecuxTRX.resolvePublickey) ⇒ <code>string</code>
    * [.prepareXPublickey(path)](#SecuxTRX.prepareXPublickey) ⇒ [<code>communicationData</code>](#communicationData)
    * [.resolveXPublickey(response, path)](#SecuxTRX.resolveXPublickey) ⇒
    * [.prepareSign(path, content)](#SecuxTRX.prepareSign) ⇒ [<code>prepared</code>](#prepared)
    * [.resolveSignature(response)](#SecuxTRX.resolveSignature) ⇒ <code>string</code>
    * [.resolveTransaction(response, serialized)](#SecuxTRX.resolveTransaction) ⇒ <code>string</code>

<br/>
<a name="SecuxTRX.addressConvert"></a>

### **SecuxTRX.addressConvert(publickey) ⇒ <code>string</code>**
*Convert secp256k1 publickey to TRX address.*

**Returns**: <code>string</code> - TRX address  

| Param | Type |
| --- | --- |
| publickey | <code>string</code> \| <code>Buffer</code> | 

<br/>
<a name="SecuxTRX.toHexAddress"></a>

### **SecuxTRX.toHexAddress(address) ⇒ <code>string</code>**
*Convert TRX address to hex representation*

**Returns**: <code>string</code> - TRX address (hex)  

| Param | Type | Description |
| --- | --- | --- |
| address | <code>string</code> | TRX address |

<br/>
<a name="SecuxTRX.prepareAddress"></a>

### **SecuxTRX.prepareAddress(path) ⇒ [<code>communicationData</code>](#communicationData)**
*Prepare data for address generation.*

**Returns**: [<code>communicationData</code>](#communicationData) - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | m/44'/195'/... |

<br/>
<a name="SecuxTRX.resolveAddress"></a>

### **SecuxTRX.resolveAddress(response) ⇒ <code>string</code>**
*Generate address from response data.*

**Returns**: <code>string</code> - TRX address  

| Param | Type | Description |
| --- | --- | --- |
| response | [<code>communicationData</code>](#communicationData) | data from device |

<br/>
<a name="SecuxTRX.preparePublickey"></a>

### **SecuxTRX.preparePublickey(path) ⇒ [<code>communicationData</code>](#communicationData)**
*Prepare data for secp256k1 publickey.*

**Returns**: [<code>communicationData</code>](#communicationData) - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | m/44'/195'/... |

<br/>
<a name="SecuxTRX.resolvePublickey"></a>

### **SecuxTRX.resolvePublickey(response) ⇒ <code>string</code>**
*Resolve secp256k1 publickey from response data.*

**Returns**: <code>string</code> - secp256k1 publickey  

| Param | Type | Description |
| --- | --- | --- |
| response | [<code>communicationData</code>](#communicationData) | data from device |

<br/>
<a name="SecuxTRX.prepareXPublickey"></a>

### **SecuxTRX.prepareXPublickey(path) ⇒ [<code>communicationData</code>](#communicationData)**
*Prepare data for xpub.*

**Returns**: [<code>communicationData</code>](#communicationData) - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | m/44'/195'/... |

<br/>
<a name="SecuxTRX.resolveXPublickey"></a>

### **SecuxTRX.resolveXPublickey(response, path) ⇒**
*Resolve xpub from response data.*

**Returns**: xpub  

| Param | Type | Description |
| --- | --- | --- |
| response | [<code>communicationData</code>](#communicationData) | data from device |
| path | <code>string</code> | m/44'/195'/... |

<br/>
<a name="SecuxTRX.prepareSign"></a>

### **SecuxTRX.prepareSign(path, content) ⇒ [<code>prepared</code>](#prepared)**
*Prepare data for signing.*

**Returns**: [<code>prepared</code>](#prepared) - prepared object  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | m/44'/195'/... |
| content | [<code>transferData</code>](#transferData) \| [<code>trc10\_Data</code>](#trc10_Data) \| [<code>trc20\_Data</code>](#trc20_Data) | transaction object |

<br/>
<a name="SecuxTRX.resolveSignature"></a>

### **SecuxTRX.resolveSignature(response) ⇒ <code>string</code>**
*Resolve signature from response data.*

**Returns**: <code>string</code> - signature (hex string)  

| Param | Type | Description |
| --- | --- | --- |
| response | [<code>communicationData</code>](#communicationData) | data from device |

<br/>
<a name="SecuxTRX.resolveTransaction"></a>

### **SecuxTRX.resolveTransaction(response, serialized) ⇒ <code>string</code>**
*Resolve transaction for broadcasting.*

**Returns**: <code>string</code> - signed raw transaction  

| Param | Type | Description |
| --- | --- | --- |
| response | [<code>communicationData</code>](#communicationData) | data from device |
| serialized | [<code>communicationData</code>](#communicationData) | raw transaction |

<br/>

<br/>
<br/>
<a name="transferData"></a>

## transferData : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| from | <code>string</code> | sending address |
| to | <code>string</code> | receiving address |
| amount | <code>number</code> | transfer amount |
| blockID | <code>string</code> |  |
| blockNumber | <code>number</code> |  |
| timestamp | <code>number</code> |  |
| [feeLimit] | <code>number</code> |  |
| [expiration] | <code>number</code> |  |

<br/>
<a name="trc10_Data"></a>

## trc10\_Data : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| from | <code>string</code> | sending address |
| to | <code>string</code> | receiving address |
| token | <code>string</code> \| <code>number</code> | token id number |
| amount | <code>number</code> | transfer amount |
| blockID | <code>string</code> |  |
| blockNumber | <code>number</code> |  |
| timestamp | <code>number</code> |  |
| [feeLimit] | <code>number</code> |  |
| [expiration] | <code>number</code> |  |

<br/>
<a name="trc20_Data"></a>

## trc20\_Data : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| from | <code>string</code> | sending address |
| to | <code>string</code> | receiving address |
| amount | <code>number</code> \| <code>string</code> | transfer amount |
| contract | <code>string</code> | contract address |
| [data] | <code>string</code> | abi encoded string |
| blockID | <code>string</code> |  |
| blockNumber | <code>number</code> |  |
| timestamp | <code>number</code> |  |
| [callValue] | <code>number</code> | amount of TRX to send to the contract when triggers. |
| [tokenId] | <code>number</code> | id of TRC-10 token to be sent to the contract. |
| [tokenValue] | <code>number</code> | amount of TRC-10 token to send to the contract when triggers. |
| [feeLimit] | <code>number</code> |  |
| [expiration] | <code>number</code> |  |

<br/>
<a name="prepared"></a>

## prepared : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| commandData | [<code>communicationData</code>](#communicationData) | data for sending to device |
| rawTx | [<code>communicationData</code>](#communicationData) | unsigned raw transaction |

<br/>

* * *

&copy; 2018-21 SecuX Technology Inc.

authors:<br/>
andersonwu@secuxtech.com