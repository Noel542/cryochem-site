const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { items } = JSON.parse(event.body);

    if (!items || items.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "Prázdny košík" }) };
    }

    // Build Stripe line items — prices include 20% Slovak VAT
    const lineItems = items.map((item) => ({
      price_data: {
        currency: "eur",
        product_data: {
          name: item.name,
          description: item.desc || undefined,
        },
        unit_amount: Math.round(item.price * 1.2 * 100), // price with 20% DPH, in cents
        tax_behavior: "inclusive",
      },
      quantity: item.qty,
    }));

    const siteUrl = process.env.URL || "http://localhost:8888";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      billing_address_collection: "required",
      shipping_address_collection: {
        allowed_countries: ["SK", "CZ", "AT", "HU", "PL", "DE"],
      },
      locale: "sk",
      success_url: `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/#produkty`,
      payment_intent_data: {
        description: "CryoChem Slovakia – objednávka",
        receipt_email: undefined,
      },
      custom_text: {
        submit: {
          message: "Vaša objednávka bude spracovaná do 24 hodín.",
        },
      },
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error("Stripe error:", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Platba zlyhala: " + err.message }),
    };
  }
};
