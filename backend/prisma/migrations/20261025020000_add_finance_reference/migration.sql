-- Store the payment-gateway reference supplied by the payer. Raw card data is
-- never accepted by the API, so this is the only card-payment identifier kept.
ALTER TABLE "FinanceTransaction" ADD COLUMN "reference" TEXT;
