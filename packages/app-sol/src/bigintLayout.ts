import { BigIntToBuffer } from "@secux/utility";
import * as BufferLayout from "@solana/buffer-layout";


function bigInt(length: number) {
    return (property?: string): BufferLayout.Layout<bigint> => {
        const layout = BufferLayout.blob(length, property);
        const decode = layout.decode.bind(layout);
        const encode = layout.encode.bind(layout);

        const bigIntLayout = layout as BufferLayout.Layout<unknown> as BufferLayout.Layout<bigint>;

        bigIntLayout.decode = (buffer: Buffer, offset: number) => {
            const src = decode(buffer, offset);
            const hexValue = Buffer.from(src).toString("hex");
            return BigInt(`0x${hexValue}`);
        };

        bigIntLayout.encode = (bigInt: bigint, buffer: Buffer, offset: number) => {
            const src = BigIntToBuffer(bigInt.toString(), length, true);
            return encode(src, buffer, offset);
        };

        return bigIntLayout;
    };
}

export const u64 = bigInt(8);