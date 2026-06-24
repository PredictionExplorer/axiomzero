import { describe, expect, it, vi } from "vitest";
import type { PublicClient } from "viem";

import {
  applyBasisPointsBuffer,
  applyGasBuffer,
  assertSufficientBalanceForTransaction,
  estimateBufferedTransactionFees,
  prepareContractWrite,
} from "@/lib/web3/transaction-preflight";

describe("transaction preflight", () => {
  it("rounds basis point buffers up", () => {
    expect(applyBasisPointsBuffer(101n, 12_000n)).toBe(122n);
  });

  it("adds the default gas buffer", () => {
    expect(applyGasBuffer(100_000n)).toBe(120_000n);
  });

  it("buffers legacy gas price estimates", async () => {
    const client = {
      getBlock: vi.fn().mockResolvedValue({ baseFeePerGas: 0n }),
      estimateFeesPerGas: vi.fn().mockResolvedValue({ gasPrice: 10n }),
    } as unknown as PublicClient;

    await expect(estimateBufferedTransactionFees(client)).resolves.toEqual({
      gasPrice: 20n,
    });
  });

  it("buffers EIP-1559 estimates above base fee", async () => {
    const client = {
      getBlock: vi.fn().mockResolvedValue({ baseFeePerGas: 100n }),
      estimateFeesPerGas: vi.fn().mockResolvedValue({
        maxFeePerGas: 80n,
        maxPriorityFeePerGas: 2n,
      }),
    } as unknown as PublicClient;

    await expect(estimateBufferedTransactionFees(client)).resolves.toEqual({
      maxFeePerGas: 160n,
      maxPriorityFeePerGas: 4n,
    });
  });

  it("throws when balance cannot cover gas and value", async () => {
    const client = {
      getBalance: vi.fn().mockResolvedValue(1n),
      estimateFeesPerGas: vi.fn().mockResolvedValue({ maxFeePerGas: 10n }),
    } as unknown as PublicClient;

    await expect(
      assertSufficientBalanceForTransaction({
        publicClient: client,
        account: "0x0000000000000000000000000000000000000001",
        gas: 10n,
        value: 1n,
      }),
    ).rejects.toThrow("Insufficient funds");
  });

  it("prepares buffered contract writes", async () => {
    const client = {
      getBlock: vi.fn().mockResolvedValue({ baseFeePerGas: 0n }),
      estimateFeesPerGas: vi.fn().mockResolvedValue({ gasPrice: 10n }),
      estimateContractGas: vi.fn().mockResolvedValue(100n),
      getBalance: vi.fn().mockResolvedValue(10_000n),
    } as unknown as PublicClient;

    await expect(
      prepareContractWrite({
        publicClient: client,
        account: "0x0000000000000000000000000000000000000001",
        address: "0x0000000000000000000000000000000000000002",
        abi: [
          {
            type: "function",
            name: "noop",
            stateMutability: "nonpayable",
            inputs: [],
            outputs: [],
          },
        ],
        functionName: "noop",
      }),
    ).resolves.toEqual({ gas: 120n, gasPrice: 20n });
  });
});
