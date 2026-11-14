import { Module } from '@nestjs/common';
import { CheckoutModule } from '../checkout/checkout.module.js';
import { CustomerTokensModule } from '../customer-auth/customer-tokens.module.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { SslcommerzService } from './sslcommerz.service.js';

@Module({
  imports: [CheckoutModule, CustomerTokensModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, SslcommerzService],
})
export class PaymentsModule {}
