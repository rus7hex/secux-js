[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lerna.js.org/)
[![view on npm](https://badgen.net/npm/v/@secux/protocol-device)](https://www.npmjs.com/package/@secux/protocol-device)
[![npm module downloads](https://badgen.net/npm/dt/@secux/protocol-device)](https://www.npmjs.org/package/@secux/protocol-device)

# `@secux/protocol-device`

> SecuX Hardware Wallet device protocol API

## Usage

```ts
import { SecuxDevice } from "@secux/protocol-device";
```

First, create instance of ITransport
- [Web Usb](https://www.npmjs.com/package/@secux/transport-webusb)
- [Web Bluetooth](https://www.npmjs.com/package/@secux/transport-webble)
- [React Native Bluetooth](https://www.npmjs.com/package/@secux/transport-reactnative)

<br/>

## Examples

1. Get version infomation of SecuX Hardware Wallet
```ts
const data = SecuxDevice.prepareGetVersion();
const response = await device.Exchange(data);
const info = SecuxDevice.resolveVersion(response);

console.log(info.transportVersion);
console.log(info.seFwVersion);
console.log(info.mcuFwVersion);
console.log(info.bootloaderVersion);
```

2. Get wallet information of SecuX Hardware Wallet
```ts
const data = SecuxDevice.prepareGetWalletInfo();
const response = await device.Exchange(data);
const info = SecuxDevice.resolveWalletInfo(response);

console.log(info.walletName);
```

3. Show address on SecuX Hardware Wallet
```ts
// show Bitcoin address, and need user confirm
const data = SecuxDevice.prepareShowAddress("m/44'/0'/0'/0/0", {
    needToConfirm: true,
    chainId: 0
});
const response = await device.Exchange(data);
SecuxDevice.resolveResponse(response);

// show Ethereum address without user confirmation
const data = SecuxDevice.prepareShowAddress("m/44'/60'/0'/0/0", {
    needToConfirm: false,
    chainId: 1
});
const response = await device.Exchange(data);
SecuxDevice.resolveResponse(response);
```

# API Reference
SecuX protocol for device management

**Kind**: global class  

* [SecuxDevice](#SecuxDevice)
    * [.prepareGetVersion()](#SecuxDevice.prepareGetVersion) ⇒ <code>communicationData</code>
    * [.resolveVersion(response)](#SecuxDevice.resolveVersion) ⇒ [<code>VersionInfo</code>](#VersionInfo)
    * [.prepareGetWalletInfo()](#SecuxDevice.prepareGetWalletInfo) ⇒ <code>communicationData</code>
    * [.resolveWalletInfo(response)](#SecuxDevice.resolveWalletInfo) ⇒ [<code>WalletInfo</code>](#WalletInfo)
    * [.prepareShowAddress(path, [option])](#SecuxDevice.prepareShowAddress) ⇒ <code>communicationData</code>
    * [.resolveResponse(response)](#SecuxDevice.resolveResponse)

<br/>
<a name="SecuxDevice.prepareGetVersion"></a>

### **SecuxDevice.prepareGetVersion() ⇒ <code>communicationData</code>**
*Get version information command.*

**Returns**: <code>communicationData</code> - data for sending to device  
<br/>
<a name="SecuxDevice.resolveVersion"></a>

### **SecuxDevice.resolveVersion(response) ⇒ [<code>VersionInfo</code>](#VersionInfo)**
*Resolve version information from device.*

**Returns**: [<code>VersionInfo</code>](#VersionInfo) - object  

| Param | Type | Description |
| --- | --- | --- |
| response | <code>communicationData</code> | data from device |

<br/>
<a name="SecuxDevice.prepareGetWalletInfo"></a>

### **SecuxDevice.prepareGetWalletInfo() ⇒ <code>communicationData</code>**
*Get wallet information command.*

**Returns**: <code>communicationData</code> - data for sending to device  
<br/>
<a name="SecuxDevice.resolveWalletInfo"></a>

### **SecuxDevice.resolveWalletInfo(response) ⇒ [<code>WalletInfo</code>](#WalletInfo)**
*Resolve wallet information from device.*

**Returns**: [<code>WalletInfo</code>](#WalletInfo) - object  

| Param | Type | Description |
| --- | --- | --- |
| response | <code>communicationData</code> | data from device |

<br/>
<a name="SecuxDevice.prepareShowAddress"></a>

### **SecuxDevice.prepareShowAddress(path, [option]) ⇒ <code>communicationData</code>**
*Show address command.*

**Returns**: <code>communicationData</code> - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | BIP32 |
| [option] | <code>AddressOption</code> |  |

<br/>
<a name="SecuxDevice.resolveResponse"></a>

### **SecuxDevice.resolveResponse(response)**
*Resolve response from device.*


| Param | Type | Description |
| --- | --- | --- |
| response | <code>communicationData</code> | data from device |

<br/>

<br/>
<a name="VersionInfo"></a>

## VersionInfo
**Properties**

| Name | Type |
| --- | --- |
| transportVersion | <code>number</code> | 
| seFwVersion | <code>string</code> | 
| mcuFwVersion | <code>string</code> | 
| bootloaderVersion | <code>string</code> | 

<br/>
<a name="WalletInfo"></a>

## WalletInfo
**Properties**

| Name | Type |
| --- | --- |
| walletIndex | <code>number</code> | 
| walletName | <code>string</code> | 
| walletStatus | <code>number</code> | 

<br/>

* * *

&copy; 2018-21 SecuX Technology Inc.

authors:<br/>
andersonwu@secuxtech.com