/*!
Copyright 2022 SecuX Technology Inc
Copyright Chen Wei-En
Copyright Wu Tsung-Yu

Licensed under the Apache License, Version 2.0 (the License);
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an AS IS BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/


export const GET_PUBLICKEY = [0x80, 0xc1] as const;
export const GET_XPUBLICKEY = [0x80, 0xc0] as const;
export const SIGN_TX = [0x70, 0xa4] as const;
export const SIGN_TX_RAW = [0x70, 0xa3] as const;
export const SIGN_MESSAGE = [0x70, 0xa5] as const;
export const SIGN_TYPEDMESSAGE = [0x70, 0xa6] as const;
export const TX_PREPARE = [0x70, 0xa0] as const;
export const TX_BEGIN = [0x80, 0x72] as const;
export const TX_END = [0x80, 0x76] as const;
export const TX_SIGN = [0x80, 0x74] as const;
