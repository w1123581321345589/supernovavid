// Stripe API operations service
// Reference: connection:conn_stripe_01KCBCFCT8W10FM19NGCPPJSP0

import { storage } from './storage';
import { getUncachableStripeClient } from './stripeClient';

export class StripeService {
  async createCustomer(email: string, userId: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.customers.create({
      email,
      metadata: { userId },
    });
  }

  async createCheckoutSession(
    customerId: string, 
    priceId: string, 
    successUrl: string, 
    cancelUrl: string,
    mode: 'subscription' | 'payment' = 'subscription',
    userId?: string
  ) {
    const stripe = await getUncachableStripeClient();
    return await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: userId ? { userId } : undefined,
    });
  }

  async createCustomerPortalSession(customerId: string, returnUrl: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  async getProduct(productId: string) {
    try {
      return await storage.getStripeProduct(productId);
    } catch (error) {
      // Fallback to Stripe API if local storage fails
      const stripe = await getUncachableStripeClient();
      return await stripe.products.retrieve(productId);
    }
  }

  async getSubscription(subscriptionId: string) {
    try {
      return await storage.getStripeSubscription(subscriptionId);
    } catch (error) {
      // Fallback to Stripe API if local storage fails
      const stripe = await getUncachableStripeClient();
      return await stripe.subscriptions.retrieve(subscriptionId);
    }
  }

  async listProducts() {
    try {
      return await storage.listStripeProducts();
    } catch (error) {
      // Fallback to Stripe API if local storage fails
      const stripe = await getUncachableStripeClient();
      const products = await stripe.products.list({ active: true, limit: 20 });
      return products.data;
    }
  }

  async listProductsWithPrices() {
    try {
      return await storage.listStripeProductsWithPrices();
    } catch (error) {
      // Fallback to Stripe API if local storage fails
      const stripe = await getUncachableStripeClient();
      
      // Fetch products from Stripe API
      const products = await stripe.products.search({
        query: "metadata['app']:'thumbgenius' AND active:'true'",
      });
      
      // Fetch prices for each product
      const result = [];
      for (const product of products.data) {
        const prices = await stripe.prices.list({
          product: product.id,
          active: true,
        });
        
        for (const price of prices.data) {
          result.push({
            product_id: product.id,
            product_name: product.name,
            product_description: product.description,
            product_active: product.active,
            product_metadata: product.metadata,
            price_id: price.id,
            unit_amount: price.unit_amount,
            currency: price.currency,
            recurring: price.recurring,
            price_active: price.active,
            price_metadata: price.metadata,
          });
        }
        
        // If product has no prices, still include it
        if (prices.data.length === 0) {
          result.push({
            product_id: product.id,
            product_name: product.name,
            product_description: product.description,
            product_active: product.active,
            product_metadata: product.metadata,
            price_id: null,
            unit_amount: null,
            currency: null,
            recurring: null,
            price_active: null,
            price_metadata: null,
          });
        }
      }
      
      return result;
    }
  }
}

export const stripeService = new StripeService();
