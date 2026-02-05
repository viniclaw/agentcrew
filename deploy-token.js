const { Clanker } = require('clanker-sdk');
const { createPublicClient, createWalletClient, http, type PublicClient } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { base } = require('viem/chains');

const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error('Error: PRIVATE_KEY environment variable required');
  process.exit(1);
}

const account = privateKeyToAccount(PRIVATE_KEY);

const publicClient = createPublicClient({
  chain: base,
  transport: http(),
}) ;

const wallet = createWalletClient({
  account,
  chain: base,
  transport: http(),
});

const clanker = new Clanker({ wallet, publicClient });

async function deploy() {
  console.log('Deploying CREW token...');
  console.log('Deployer:', account.address);

  const { txHash, waitForTransaction, error } = await clanker.deploy({
    name: 'AgentCrew',
    symbol: 'CREW',
    image: 'https://raw.githubusercontent.com/viniclaw/viniapp-logos/master/viniclaw-logo.png',
    tokenAdmin: account.address,
    metadata: {
      description: 'Coordination token for AI agent collaboration. Stake to form crews, earn by completing tasks, govern the protocol.',
      socialMediaUrls: [
        { platform: 'website', url: 'https://agentcrew.xyz' },
        { platform: 'twitter', url: 'https://twitter.com/viniclaw' },
      ],
    },
    context: {
      interface: 'Clanker SDK',
      platform: 'farcaster',
    },
    vault: {
      percentage: 15,
      lockupDuration: 7 * 24 * 60 * 60, // 7 days
      vestingDuration: 30 * 24 * 60 * 60, // 30 days
      recipient: account.address,
    },
    rewards: {
      recipients: [
        {
          recipient: account.address,
          admin: account.address,
          bps: 8000, // 80% to creator
          token: 'Paired',
        },
        {
          recipient: '0xF60633D02690e2A15A54AB919925F3d038Df163e', // Bankr interface
          admin: '0xF60633D02690e2A15A54AB919925F3d038Df163e',
          bps: 2000, // 20% to interface
          token: 'Paired',
        },
      ],
    },
    pool: {
      pairedToken: '0x4200000000000000000000000000000000000006', // WETH
      positions: 'Standard',
    },
    fees: 'StaticBasic',
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
}

deploy().catch(console.error);
