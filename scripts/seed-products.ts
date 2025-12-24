// Stripe product seed script for new pricing tiers
// Reference: connection:conn_stripe_01KCBCFCT8W10FM19NGCPPJSP0
// Run with: npx tsx scripts/seed-products.ts

import Stripe from 'stripe';

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  const connectorName = 'stripe';
  const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
  const targetEnvironment = isProduction ? 'production' : 'development';

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set('include_secrets', 'true');
  url.searchParams.set('connector_names', connectorName);
  url.searchParams.set('environment', targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X_REPLIT_TOKEN': xReplitToken
    }
  });

  const data = await response.json();
  const connectionSettings = data.items?.[0];

  if (!connectionSettings?.settings?.secret) {
    throw new Error(`Stripe ${targetEnvironment} connection not found`);
  }

  return connectionSettings.settings.secret;
}

async function seedProducts() {
  console.log('Starting Stripe product seeding (new pricing tiers)...');
  
  const secretKey = await getCredentials();
  const stripe = new Stripe(secretKey, {
    apiVersion: '2025-11-17.clover',
  });

  // Check if new products already exist
  const existingProducts = await stripe.products.search({
    query: "metadata['app']:'supernovavid'",
  });

  const existingPlans = existingProducts.data.map(p => p.metadata?.plan || p.metadata?.type);
  console.log('Existing plans:', existingPlans);

  // Create Creator plan if not exists
  if (!existingPlans.includes('creator')) {
    console.log('Creating Creator plan...');
    const creatorProduct = await stripe.products.create({
      name: 'Creator',
      description: '10 autonomous tests per month. AI-generated thumbnails, automatic A/B testing on YouTube, real-time dashboard, 95% confidence winner selection.',
      metadata: {
        app: 'supernovavid',
        type: 'subscription',
        plan: 'creator',
      },
    });

    const creatorPrice = await stripe.prices.create({
      product: creatorProduct.id,
      unit_amount: 4500, // $45.00
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
      metadata: {
        app: 'supernovavid',
        plan: 'creator',
      },
    });

    console.log(`  Created: ${creatorProduct.name} (${creatorProduct.id})`);
    console.log(`  Price: ${creatorPrice.id} - $${creatorPrice.unit_amount! / 100}/month`);
  } else {
    console.log('Creator plan already exists, skipping...');
  }

  // Create Pro plan if not exists
  if (!existingPlans.includes('pro')) {
    console.log('Creating Pro plan...');
    const proProduct = await stripe.products.create({
      name: 'Pro',
      description: 'Unlimited autonomous tests. Everything in Creator plus priority support, advanced analytics, batch optimization, and API access.',
      metadata: {
        app: 'supernovavid',
        type: 'subscription',
        plan: 'pro',
      },
    });

    const proPrice = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: 19900, // $199.00
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
      metadata: {
        app: 'supernovavid',
        plan: 'pro',
      },
    });

    console.log(`  Created: ${proProduct.name} (${proProduct.id})`);
    console.log(`  Price: ${proPrice.id} - $${proPrice.unit_amount! / 100}/month`);
  } else {
    console.log('Pro plan already exists, skipping...');
  }

  // Update per-video price to $15 if needed
  const perVideoProduct = existingProducts.data.find(p => p.metadata?.type === 'per_video');
  if (perVideoProduct) {
    const prices = await stripe.prices.list({ product: perVideoProduct.id, active: true });
    const currentPrice = prices.data[0];
    
    if (currentPrice && currentPrice.unit_amount !== 1500) {
      console.log('Updating per-video price to $15...');
      
      // Deactivate old price
      await stripe.prices.update(currentPrice.id, { active: false });
      
      // Create new price
      const newPrice = await stripe.prices.create({
        product: perVideoProduct.id,
        unit_amount: 1500, // $15.00
        currency: 'usd',
        metadata: {
          app: 'supernovavid',
          type: 'per_video',
        },
      });
      
      console.log(`  Updated price: ${newPrice.id} - $${newPrice.unit_amount! / 100}/video`);
    } else {
      console.log('Per-video price already at $15, skipping...');
    }
  }

  console.log('\nProduct seeding complete!');
  
  // List all products
  const allProducts = await stripe.products.search({
    query: "metadata['app']:'supernovavid' AND active:'true'",
  });
  
  console.log('\nActive SupernovaVid products:');
  for (const product of allProducts.data) {
    const prices = await stripe.prices.list({ product: product.id, active: true });
    for (const price of prices.data) {
      const recurring = price.recurring ? `/${price.recurring.interval}` : '';
      console.log(`  - ${product.name}: $${price.unit_amount! / 100}${recurring} (${price.id})`);
    }
  }
}

seedProducts().catch((error) => {
  console.error('Error seeding products:', error);
  process.exit(1);
});
