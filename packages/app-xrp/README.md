[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lerna.js.org/)
[![view on npm](https://badgen.net/npm/v/@secux/app-xrp)](https://www.npmjs.com/package/@secux/app-xrp)
[![npm module downloads](https://badgen.net/npm/dt/@secux/app-xrp)](https://www.npmjs.org/package/@secux/app-xrp)

# `@secux/app-xrp`

> SecuX Hardware Wallet XRP API

## Usage

```ts
import { SecuxXRP } from "@secux/app-xrp";
```

First, create instance of ITransport
- [Web Usb](https://www.npmjs.com/package/@secux/transport-webusb)
- [Web Bluetooth](https://www.npmjs.com/package/@secux/transport-webble)
- [React Native Bluetooth](https://www.npmjs.com/package/@secux/transport-reactnative)

<br/>

## Examples
1. Get address of bip44 path
```ts
const address = await device.getAddress("m/44'/144'/0'/0/0");

/*

// transfer data to hardware wallet by custom transport layer.
const data = SecuxXRP.prepareAddress("m/44'/144'/0'/0/0");
const response = await device.Exchange(data);
const address = SecuxXRP.resolveAddress(response);

*/
```

2. Sign transaction
```ts
let payment = {
    TransactionType: "Payment",
    Account: "rD17Ez7fBpuwVp6smfjYhPKD3pwiN5QGKX",
    Destination: "rGNitVptpmpCNYC23LbQ9yfCnAf1Z6gq7X",
    amount: 1e6
};

// fetch data from XRP api
const { BroadcastClient } = require("xrpl");
client = new BroadcastClient(["wss://s1.ripple.com"]);
await client.connect();
payment = await client.autofill(payment);

// sign
const raw_tx = await device.sign("m/44'/144'/0'/0/0", payment);

/*

// transfer data to hardware wallet by custom transport layer.
const { commandData, serialized } = SecuxXRP.prepareSign("m/44'/144'/0'/0/0", {
    ...payment,
    SigningPubKey: "026771406ace54da2cae8b168862697ca35bc3db56c90f4270adb307ac9a38fe9c"
});
const response = await device.Exchange(data);
const raw_tx = SecuxXRP.resolveTransaction(response, serialized);

*/

// broadcast
await client.submit(raw_tx);
```

# API Reference
XRP package for SecuX device

**Kind**: global class  

* [SecuxXRP](#SecuxXRP)
    * [.prepareAddress](#SecuxXRP.prepareAddress) ⇒ <code>communicationData</code>
    * [.addressConvert(publickey)](#SecuxXRP.addressConvert) ⇒ <code>string</code>
    * [.resolveAddress(response)](#SecuxXRP.resolveAddress) ⇒ <code>string</code>
    * [.preparePublickey(path)](#SecuxXRP.preparePublickey) ⇒ <code>communicationData</code>
    * [.resolvePublickey(response)](#SecuxXRP.resolvePublickey) ⇒ <code>string</code>
    * [.prepareXPublickey(path)](#SecuxXRP.prepareXPublickey) ⇒ <code>communicationData</code>
    * [.resolveXPublickey(response, path)](#SecuxXRP.resolveXPublickey) ⇒ <code>string</code>
    * [.prepareSign(path, json)](#SecuxXRP.prepareSign) ⇒ [<code>prepared</code>](#prepared)
    * [.resolveSignature(response)](#SecuxXRP.resolveSignature) ⇒ <code>string</code>
    * [.resolveTransaction(response, serialized)](#SecuxXRP.resolveTransaction) ⇒ <code>string</code>

<br/>
<a name="SecuxXRP.prepareAddress"></a>

### **SecuxXRP.prepareAddress ⇒ <code>communicationData</code>**
*Prepare data for XRP address.*

**Returns**: <code>communicationData</code> - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | m/44'/144'/... |

<br/>
<a name="SecuxXRP.addressConvert"></a>

### **SecuxXRP.addressConvert(publickey) ⇒ <code>string</code>**
*Convert secp256k1 publickey to XRP address.*

**Returns**: <code>string</code> - XRP address  

| Param | Type | Description |
| --- | --- | --- |
| publickey | <code>string</code> \| <code>Buffer</code> | secp256k1 publickey |

<br/>
<a name="SecuxXRP.resolveAddress"></a>

### **SecuxXRP.resolveAddress(response) ⇒ <code>string</code>**
*Generate XRP address from response data.*

**Returns**: <code>string</code> - XRP address  

| Param | Type | Description |
| --- | --- | --- |
| response | <code>communicationData</code> | data from device |

<br/>
<a name="SecuxXRP.preparePublickey"></a>

### **SecuxXRP.preparePublickey(path) ⇒ <code>communicationData</code>**
*Prepare data for secp256k1 publickey.*

**Returns**: <code>communicationData</code> - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | m/44'/144'/... |

<br/>
<a name="SecuxXRP.resolvePublickey"></a>

### **SecuxXRP.resolvePublickey(response) ⇒ <code>string</code>**
*Resolve secp256k1 publickey from response data.*

**Returns**: <code>string</code> - secp256k1 publickey (hex string)  

| Param | Type | Description |
| --- | --- | --- |
| response | <code>communicationData</code> | data from device |

<br/>
<a name="SecuxXRP.prepareXPublickey"></a>

### **SecuxXRP.prepareXPublickey(path) ⇒ <code>communicationData</code>**
*Prepare data for xpub.*

**Returns**: <code>communicationData</code> - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | m/44'/144'/... |

<br/>
<a name="SecuxXRP.resolveXPublickey"></a>

### **SecuxXRP.resolveXPublickey(response, path) ⇒ <code>string</code>**
*Generate xpub from response data.*

**Returns**: <code>string</code> - xpub  

| Param | Type | Description |
| --- | --- | --- |
| response | <code>communicationData</code> | data from device |
| path | <code>string</code> | m/44'/144'/... |

<br/>
<a name="SecuxXRP.prepareSign"></a>

### **SecuxXRP.prepareSign(path, json) ⇒ [<code>prepared</code>](#prepared)**
*Prepare data for signing.*

**Returns**: [<code>prepared</code>](#prepared) - prepared object  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | m/44'/144'/... |
| json | [<code>baseObject</code>](#baseObject) | transaction object (same as XRP api) |

<br/>
<a name="SecuxXRP.resolveSignature"></a>

### **SecuxXRP.resolveSignature(response) ⇒ <code>string</code>**
*Resolve signature from response data.*

**Returns**: <code>string</code> - signature (hex string)  

| Param | Type | Description |
| --- | --- | --- |
| response | <code>communicationData</code> | data from device |

<br/>
<a name="SecuxXRP.resolveTransaction"></a>

### **SecuxXRP.resolveTransaction(response, serialized) ⇒ <code>string</code>**
*Generate raw transaction for broadcasting.*

**Returns**: <code>string</code> - signed raw transaction  

| Param | Type | Description |
| --- | --- | --- |
| response | <code>communicationData</code> | data from device |
| serialized | <code>communicationData</code> |  |

<br/>

<br/>
<a name="baseObject"></a>

## baseObject
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| TransactionType | <code>string</code> |  |
| SigningPubKey | <code>string</code> \| <code>Buffer</code> | ed25519 publickey |
| Sequence | <code>number</code> |  |
| Fee | <code>string</code> \| <code>number</code> |  |
| LastLedgerSequence | <code>number</code> |  |
| [Account] | <code>string</code> | sending address |
| [Destination] | <code>string</code> | receiving address |
| [Amount] | <code>string</code> \| <code>number</code> |  |
| [SourceTag] | <code>number</code> |  |
| [DestinationTag] | <code>number</code> |  |

<br/>
<a name="prepared"></a>

## prepared
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| commandData | <code>commandData</code> | data for sending to device |
| serialized | <code>commandData</code> |  |

<br/>

* * *

&copy; 2018-21 SecuX Technology Inc.

authors:<br/>
andersonwu@secuxtech.com