import { Interface } from 'ethers';
import type { BundlerUserOperation, Hex } from '../types';

const smartAccountInterface = new Interface([
  'function execute(address to, uint256 value, bytes data)',
  'function executeBatch(address[] to, uint256[] values, bytes[] data)',
]);

export interface SmartAccountCall {
  target: Hex;
  data: Hex;
  value?: bigint | number | string;
}

export interface CreateExecuteUserOpInput {
  sender: Hex;
  nonce: bigint | number | string;
  target: Hex;
  data: Hex;
  value?: bigint | number | string;
  initCode?: Hex;
  callGasLimit: bigint | number | string;
  verificationGasLimit: bigint | number | string;
  preVerificationGas: bigint | number | string;
  maxFeePerGas: bigint | number | string;
  maxPriorityFeePerGas: bigint | number | string;
}

export interface CreateExecuteBatchUserOpInput {
  sender: Hex;
  nonce: bigint | number | string;
  calls: SmartAccountCall[];
  initCode?: Hex;
  callGasLimit: bigint | number | string;
  verificationGasLimit: bigint | number | string;
  preVerificationGas: bigint | number | string;
  maxFeePerGas: bigint | number | string;
  maxPriorityFeePerGas: bigint | number | string;
}

/** Encodes SmartAccount.execute(address,uint256,bytes). */
export function encodeSmartAccountExecute(target: Hex, value: bigint | number | string, data: Hex): Hex {
  return smartAccountInterface.encodeFunctionData('execute', [target, BigInt(value), data]) as Hex;
}

/** Encodes SmartAccount.executeBatch(address[],uint256[],bytes[]). */
export function encodeSmartAccountExecuteBatch(calls: SmartAccountCall[]): Hex {
  return smartAccountInterface.encodeFunctionData(
    'executeBatch',
    [
      calls.map((call) => call.target),
      calls.map((call) => BigInt(call.value ?? 0)),
      calls.map((call) => call.data),
    ],
  ) as Hex;
}

/** Creates a bundler-ready draft that routes one inner call through SmartAccount.execute(...). */
export function createExecuteUserOp(input: CreateExecuteUserOpInput): BundlerUserOperation {
  return {
    sender: input.sender,
    nonce: input.nonce,
    ...(input.initCode ? { initCode: input.initCode } : {}),
    callData: encodeSmartAccountExecute(input.target, input.value ?? 0, input.data),
    callGasLimit: input.callGasLimit,
    verificationGasLimit: input.verificationGasLimit,
    preVerificationGas: input.preVerificationGas,
    maxFeePerGas: input.maxFeePerGas,
    maxPriorityFeePerGas: input.maxPriorityFeePerGas,
  };
}

/** Creates a bundler-ready draft that routes multiple inner calls through SmartAccount.executeBatch(...). */
export function createExecuteBatchUserOp(input: CreateExecuteBatchUserOpInput): BundlerUserOperation {
  return {
    sender: input.sender,
    nonce: input.nonce,
    ...(input.initCode ? { initCode: input.initCode } : {}),
    callData: encodeSmartAccountExecuteBatch(input.calls),
    callGasLimit: input.callGasLimit,
    verificationGasLimit: input.verificationGasLimit,
    preVerificationGas: input.preVerificationGas,
    maxFeePerGas: input.maxFeePerGas,
    maxPriorityFeePerGas: input.maxPriorityFeePerGas,
  };
}
