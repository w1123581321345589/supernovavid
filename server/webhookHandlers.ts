// Stripe webhook handlers
// Reference: connection:conn_stripe_01KCBCFCT8W10FM19NGCPPJSP0

import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { storage } from './storage';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string, uuid: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    // First let stripe-replit-sync process the webhook (syncs to stripe schema)
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature, uuid);

    // Now handle custom logic for specific events
    await this.handleCustomEvents(payload);
  }

  private static async handleCustomEvents(payload: Buffer): Promise<void> {
    try {
      const event = JSON.parse(payload.toString());
      
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;
      }
    } catch (error) {
      console.error('Error handling custom webhook event:', error);
    }
  }

  private static async handleCheckoutCompleted(session: any): Promise<void> {
    const customerId = session.customer;
    const subscriptionId = session.subscription;
    const userIdFromMetadata = session.metadata?.userId;
    
    if (!customerId && !userIdFromMetadata) {
      console.log('Checkout completed without customer ID or user metadata');
      return;
    }

    // Find user by stripeCustomerId or by userId from metadata
    let user = customerId ? await storage.getUserByStripeCustomerId(customerId) : null;
    
    if (!user && userIdFromMetadata) {
      user = await storage.getUser(userIdFromMetadata);
    }
    
    if (!user) {
      console.log(`No user found for Stripe customer ${customerId} or userId ${userIdFromMetadata}`);
      return;
    }

    // Get subscription details to determine plan
    let subscriptionPlan = 'launch'; // default
    
    if (subscriptionId) {
      try {
        const stripe = await getUncachableStripeClient();
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        
        // Check price/product metadata or amount to determine plan
        const priceId = subscription.items.data[0]?.price?.id;
        const amount = subscription.items.data[0]?.price?.unit_amount || 0;
        
        // Determine plan based on price amount (5900 = Launch $59, 14900 = Scale $149)
        if (amount >= 14900) {
          subscriptionPlan = 'scale';
        } else {
          subscriptionPlan = 'launch';
        }
      } catch (err) {
        console.error('Error fetching subscription details:', err);
      }
    }

    // Update user subscription status
    await storage.updateUserStripeInfo(user.id, {
      subscriptionStatus: 'active',
      subscriptionPlan: subscriptionPlan,
    });

    console.log(`Activated subscription for user ${user.id}: ${subscriptionPlan} plan`);
  }

  private static async handleSubscriptionUpdated(subscription: any): Promise<void> {
    const customerId = subscription.customer;
    const status = subscription.status;
    
    // Find user by stripeCustomerId
    const user = await storage.getUserByStripeCustomerId(customerId);
    
    if (!user) {
      console.log(`No user found for Stripe customer ${customerId}`);
      return;
    }

    // Map Stripe status to our status
    let subscriptionStatus: 'active' | 'canceled' | 'past_due' | 'trialing' = 'active';
    if (status === 'canceled' || status === 'unpaid') {
      subscriptionStatus = 'canceled';
    } else if (status === 'past_due') {
      subscriptionStatus = 'past_due';
    } else if (status === 'trialing') {
      subscriptionStatus = 'trialing';
    }

    await storage.updateUserStripeInfo(user.id, {
      subscriptionStatus: subscriptionStatus,
    });

    console.log(`Updated subscription status for user ${user.id}: ${subscriptionStatus}`);
  }

  private static async handleSubscriptionDeleted(subscription: any): Promise<void> {
    const customerId = subscription.customer;
    
    // Find user by stripeCustomerId
    const user = await storage.getUserByStripeCustomerId(customerId);
    
    if (!user) {
      console.log(`No user found for Stripe customer ${customerId}`);
      return;
    }

    await storage.updateUserStripeInfo(user.id, {
      subscriptionStatus: 'canceled',
    });

    console.log(`Subscription canceled for user ${user.id}`);
  }
}
