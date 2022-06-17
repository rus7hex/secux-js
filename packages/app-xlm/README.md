[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lerna.js.org/)
[![view on npm](https://badgen.net/npm/v/@secux/app-xlm)](https://www.npmjs.com/package/@secux/app-xlm)
[![npm module downloads](https://badgen.net/npm/dt/@secux/app-xlm)](https://www.npmjs.org/package/@secux/app-xlm)

# `@secux/app-xlm`

> SecuX Hardware Wallet XLM API

## Usage

```ts
import { SecuxXLM } from "@secux/app-xlm";
```

First, create instance of ITransport
- [Web Usb](https://www.npmjs.com/package/@secux/transport-webusb)
- [Web Bluetooth](https://www.npmjs.com/package/@secux/transport-webble)
- [React Native Bluetooth](https://www.npmjs.com/package/@secux/transport-reactnative)

<br/>

## Examples
1. Get address of bip44 path
```ts
const address = await device.getAddress("m/44'/148'/0'");

/*

// transfer data to hardware wallet by custom transport layer.
const data = SecuxXLM.prepareAddress("m/44'/148'/0'");
const response = await device.Exchange(data);
const address = SecuxXLM.resolve(response);

*/
```

2. Sign transaction
```ts
const content = {
    to: "GDATJJ7NZIQ5GR4JBZVUHOGVVSPFEQF2JQ4KIOFZMBDJCH2PJFZJU7UK",
    amount: "123.456",
    sequence: 115521361698357411,
    fee: 100,
    // for new address that don't have on-chain data
    // needCreateAccount: true
}

const { raw_tx, signature } = await device.sign("m/44'/148'/0'", content);

/*

// transfer data to hardware wallet by custom transport layer.
const { commandData, serialized } = SecuxXLM.prepareSign("m/44'/148'/0'", content);
const response = await device.Exchange(commandData);
const raw_tx = SecuxXLM.resolveTransaction(response, serialized);

*/
```

# API Reference
XLM package for SecuX device

**Kind**: global class  

* [SecuxXLM](#SecuxXLM)
    * [.prepareAddress](#SecuxXLM.prepareAddress) ⇒ <code>communicationData</code>
    * [.addressConvert(publickey)](#SecuxXLM.addressConvert) ⇒ <code>string</code>
    * [.resolveAddress(response)](#SecuxXLM.resolveAddress) ⇒ <code>string</code>
    * [.preparePublickey(path)](#SecuxXLM.preparePublickey) ⇒ <code>communicationData</code>
    * [.resolvePublickey(response)](#SecuxXLM.resolvePublickey) ⇒ <code>string</code>
    * [.prepareSign(path, content)](#SecuxXLM.prepareSign) ⇒ [<code>prepared</code>](#prepared)
    * [.resolveSignature(response)](#SecuxXLM.resolveSignature) ⇒ <code>string</code>
    * [.resolveTransaction(response, serialized)](#SecuxXLM.resolveTransaction) ⇒ <code>string</code>

<br/>
<a name="SecuxXLM.prepareAddress"></a>

### **SecuxXLM.prepareAddress ⇒ <code>communicationData</code>**
*Prepare data for XLM address.*

**Returns**: <code>communicationData</code> - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | BIP32 path (hardened child key), ex: m/44'/148'/0' |

<br/>
<a name="SecuxXLM.addressConvert"></a>

### **SecuxXLM.addressConvert(publickey) ⇒ <code>string</code>**
*Convert ED25519 publickey to XLM address.*

**Returns**: <code>string</code> - XLM address  

| Param | Type | Description |
| --- | --- | --- |
| publickey | <code>string</code> \| <code>Buffer</code> | ed25519 publickey |

<br/>
<a name="SecuxXLM.resolveAddress"></a>

### **SecuxXLM.resolveAddress(response) ⇒ <code>string</code>**
*Generate XLM address from response data.*

**Returns**: <code>string</code> - XLM address  

| Param | Type | Description |
| --- | --- | --- |
| response | <code>communicationData</code> | data from device |

<br/>
<a name="SecuxXLM.preparePublickey"></a>

### **SecuxXLM.preparePublickey(path) ⇒ <code>communicationData</code>**
*Prepare data for ed25519 publickey.*

**Returns**: <code>communicationData</code> - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | BIP32 path (hardened child key), ex: m/44'/148'/0' |

<br/>
<a name="SecuxXLM.resolvePublickey"></a>

### **SecuxXLM.resolvePublickey(response) ⇒ <code>string</code>**
*Resove ed25519 publickey from response data.*

**Returns**: <code>string</code> - ed2519 publickey (hex string)  

| Param | Type | Description |
| --- | --- | --- |
| response | <code>communicationData</code> | data from device |

<br/>
<a name="SecuxXLM.prepareSign"></a>

### **SecuxXLM.prepareSign(path, content) ⇒ [<code>prepared</code>](#prepared)**
*Prepare data for signing.*

**Returns**: [<code>prepared</code>](#prepared) - prepared object  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | BIP32 path (hardened child key), ex: m/44'/148'/0' |
| content | [<code>txDetail</code>](#txDetail) | transaction object |

<br/>
<a name="SecuxXLM.resolveSignature"></a>

### **SecuxXLM.resolveSignature(response) ⇒ <code>string</code>**
*Resolve signature from response data.*

**Returns**: <code>string</code> - signature (hex string)  

| Param | Type | Description |
| --- | --- | --- |
| response | <code>communicationData</code> | data from device |

<br/>
<a name="SecuxXLM.resolveTransaction"></a>

### **SecuxXLM.resolveTransaction(response, serialized) ⇒ <code>string</code>**
*Generate raw transaction for broadcasting.*

**Returns**: <code>string</code> - signed raw transaction  

| Param | Type | Description |
| --- | --- | --- |
| response | <code>communicationData</code> | data from device |
| serialized | <code>communicationData</code> | serialized object |

<br/>

<br/>
<a name="txDetail"></a>

## txDetail
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| from | <code>string</code> | sending address |
| to | <code>string</code> | receiving address |
| amount | <code>string</code> | transfer amount |
| sequence | <code>string</code> \| <code>number</code> |  |
| fee | <code>string</code> \| <code>number</code> |  |
| [memo] | [<code>memoObj</code>](#memoObj) |  |
| [networkPassphrase] | <code>string</code> | network for XLM, default is mainnet |
| [needCreateAccount] | <code>boolean</code> | pay for creating new account, default: false |

<br/>
<a name="memoObj"></a>

## memoObj
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| Type | <code>string</code> | MemoType |
| Value | <code>string</code> |  |

<br/>
<a name="prepared"></a>

## prepared
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| commandData | <code>communicationData</code> | data for sending to device |
| serialized | <code>communicationData</code> | serialized object |

<br/>

* * *

&copy; 2018-21 SecuX Technology Inc.

authors:<br/>
andersonwu@secuxtech.com