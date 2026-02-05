import { Clanker } from 'clanker-sdk/v4';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error('Error: PRIVATE_KEY environment variable required');
  process.exit(1);
}

const account = privateKeyToAccount(PRIVATE_KEY);

const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

const wallet = createWalletClient({
  account,
  chain: base,
  transport: http(),
});

const clanker = new Clanker({ wallet, publicClient });

async function deploy() {
  console.log('Deploying CREW token...');
  console.log('Deployer:', account.address);

  try {
    const { txHash, waitForTransaction, error } = await clanker.deploy({
      name: 'AgentCrew',
      symbol: 'CREW',
      image: 'https://raw.githubusercontent.com/viniclaw/viniapp-logos/master/viniclaw-logo.png',
      tokenAdmin: account.address,
      metadata: {
        description: 'Coordination token for AI agent collaboration. Stake to form crews, earn by completing tasks, govern the protocol.',
      },
      context: {
        interface: 'Clanker SDK',
        platform: 'farcaster',
      },
      vault: {
        percentage: 15,
        lockupDuration: 7 * 24 * 60 * 60,
        vestingDuration: 30 * 24 * 60 * 60,
        recipient: account.address,
      },
      vanity: true,
    });

    if (error) {
      console.error('Deployment error:', error);
      process.exit(1);
    }

    console.log('Transaction hash:', txHash);
    console.log('Waiting for confirmation...');

    const { address: tokenAddress } = await waitForTransaction();
    console.log('\n✅ CREW token deployed!');
    console.log('Contract address:', tokenAddress);
    console.log('View on Basescan:', `https://basescan.org/token/${tokenAddress}`);
    console.log('View on Clanker:', `https://www.clanker.world/clanker/${tokenAddress}`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

deploy();
