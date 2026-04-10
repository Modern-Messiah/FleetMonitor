import { Module } from '@nestjs/common';
import { FleetGateway } from './fleet.gateway';
import { VehiclesModule } from '../vehicles/vehicles.module';

@Module({
  imports: [VehiclesModule],
  providers: [FleetGateway],
  exports: [FleetGateway],
})
export class GatewayModule {}
