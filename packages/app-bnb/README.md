[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lerna.js.org/)
[![view on npm](https://badgen.net/npm/v/@secux/app-bnb)](https://www.npmjs.com/package/@secux/app-bnb)
[![npm module downloads](https://badgen.net/npm/dt/@secux/app-bnb)](https://www.npmjs.org/package/@secux/app-bnb)

# `@secux/app-bnb`

> SecuX Hardware Wallet BNB API

## Usage

```ts
import { SecuxBNB } from "@secux/app-bnb";
```

First, create instance of ITransport
- [Web Usb](https://www.npmjs.com/package/@secux/transport-webusb)
- [Web Bluetooth](https://www.npmjs.com/package/@secux/transport-webble)
- [React Native Bluetooth](https://www.npmjs.com/package/@secux/transport-reactnative)

<br />

## Examples
1. Get address of bip44 path
```ts
const path = "m/44'/714'/0'/0/0";
const address = await device.getAddress(path);

/*

// transfer data to hardware wallet by custom transport layer
const data = SecuxBNB.prepareAddress(path);
const response = await device.Exchange(data);
const address = SecuxBNB.resolveAddress(response);

*/
```

2. Sign transaction
```ts
const { raw_tx, signature } = await deivce.sign(
"m/44'/714'/0'/0/0",
{
to: "bnb17jr3n9xaxm92fp5dznuazql2c2x6ypw2gvuvmy",
amount: 1e18
}
);

/*

// transfer data to hardware wallet by custom transport layer
const data = SecuxBNB.prepareSign(
"m/44'/714'/0'/0/0",
{
from: "bnb1rcxjc3a6va0ldwzerx2t58g3sz6ss6x7cglwyc",
to: "bnb17jr3n9xaxm92fp5dznuazql2c2x6ypw2gvuvmy",
amount: 1e18
}
);

*/
```

# API Reference
BNB package for SecuX device

**Kind**: global class  

* [SecuxBNB](#SecuxBNB)
    * [.prepareAddress](#SecuxBNB.prepareAddress) ⇒ <code>communicationData</code>
    * [.addressConvert(publickey)](#SecuxBNB.addressConvert) ⇒ <code>string</code>
    * [.resolveAddress(response)](#SecuxBNB.resolveAddress) ⇒ <code>string</code>
    * [.preparePublickey(path)](#SecuxBNB.preparePublickey) ⇒ <code>communicationData</code>
    * [.resolvePublickey(response)](#SecuxBNB.resolvePublickey) ⇒ <code>string</code>
    * [.prepareXPublickey(path)](#SecuxBNB.prepareXPublickey) ⇒ <code>communicationData</code>
    * [.resolveXPublickey(response, path)](#SecuxBNB.resolveXPublickey) ⇒ <code>string</code>
    * [.prepareSign(path, content)](#SecuxBNB.prepareSign) ⇒ [<code>prepared</code>](#prepared)
    * [.resolveSignature(response)](#SecuxBNB.resolveSignature) ⇒ <code>string</code>
    * [.resolveTransaction(response, serialized)](#SecuxBNB.resolveTransaction) ⇒ <code>string</code>

<br/>
<a name="SecuxBNB.prepareAddress"></a>

### **SecuxBNB.prepareAddress ⇒ <code>communicationData</code>**
*Prepare data for address generation.*

**Returns**: <code>communicationData</code> - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | m/44'/714'/... |

<br/>
<a name="SecuxBNB.addressConvert"></a>

### **SecuxBNB.addressConvert(publickey) ⇒ <code>string</code>**
*Convert secp256k1 publickey to BNB address.*

**Returns**: <code>string</code> - BNB address  

| Param | Type | Description |
| --- | --- | --- |
| publickey | <code>string</code> \| <code>Buffer</code> | secp256k1 publickey |

<br/>
<a name="SecuxBNB.resolveAddress"></a>

### **SecuxBNB.resolveAddress(response) ⇒ <code>string</code>**
*Generate address from response data.*

**Returns**: <code>string</code> - BNB address  

| Param | Type | Description |
| --- | --- | --- |
| response | <code>communicationData</code> | data from device |

<br/>
<a name="SecuxBNB.preparePublickey"></a>

### **SecuxBNB.preparePublickey(path) ⇒ <code>communicationData</code>**
*Prepare data for secp256k1 publickey.*

**Returns**: <code>communicationData</code> - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | m/44'/714'/... |

<br/>
<a name="SecuxBNB.resolvePublickey"></a>

### **SecuxBNB.resolvePublickey(response) ⇒ <code>string</code>**
*Resolve secp256k1 publickey from response data.*

**Returns**: <code>string</code> - secp256k1 publickey (hex string)  

| Param | Type | Description |
| --- | --- | --- |
| response | <code>communicationData</code> | data from device |

<br/>
<a name="SecuxBNB.prepareXPublickey"></a>

### **SecuxBNB.prepareXPublickey(path) ⇒ <code>communicationData</code>**
*Prepare data for xpub.*

**Returns**: <code>communicationData</code> - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | m/44'/714'/... |

<br/>
<a name="SecuxBNB.resolveXPublickey"></a>

### **SecuxBNB.resolveXPublickey(response, path) ⇒ <code>string</code>**
*Resolve xpub from response data.*

**Returns**: <code>string</code> - xpub  

| Param | Type | Description |
| --- | --- | --- |
| response | <code>communicationData</code> | data from device |
| path | <code>string</code> | m/44'/714'/... |

<br/>
<a name="SecuxBNB.prepareSign"></a>

### **SecuxBNB.prepareSign(path, content) ⇒ [<code>prepared</code>](#prepared)**
*Prepare data for signing.*

**Returns**: [<code>prepared</code>](#prepared) - return object  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | m/44'/714'/... |
| content | [<code>txDetail</code>](#txDetail) | transaction object |

<br/>
<a name="SecuxBNB.resolveSignature"></a>

### **SecuxBNB.resolveSignature(response) ⇒ <code>string</code>**
*Resolve signature from response data*

**Returns**: <code>string</code> - signature (hex string)  

| Param | Type | Description |
| --- | --- | --- |
| response | <code>communicationData</code> | data from device |

<br/>
<a name="SecuxBNB.resolveTransaction"></a>

### **SecuxBNB.resolveTransaction(response, serialized) ⇒ <code>string</code>**
*Resolve raw transaction for broadcasting*

**Returns**: <code>string</code> - signed raw transaction  

| Param | Type | Description |
| --- | --- | --- |
| response | <code>communicationData</code> | data from device |
| serialized | <code>communicationData</code> |  |

<br/>

<br/>
<a name="txDetail"></a>

## txDetail
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| publickey | <code>string</code> \| <code>Buffer</code> | sender's publickey |
| to | <code>string</code> | receiving address |
| amount | <code>number</code> | BNB has 8 decimals |
| [chainId] | <code>string</code> | use specific BNB network |
| [accountNumber] | <code>number</code> | for replay protection |
| [sequence] | <code>number</code> | for replay protection |
| [memo] | <code>string</code> |  |

<br/>
<a name="prepared"></a>

## prepared
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| commandData | <code>communicationData</code> | data for sending to device |
| serialized | <code>communicationData</code> |  |

<br/>

* * *

&copy; 2018-21 SecuX Technology Inc.

authors:<br/>
andersonwu@secuxtech.com