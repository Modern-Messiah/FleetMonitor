import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { VehiclesService } from './vehicles.service';
import { VehicleResponseDto, VehicleDetailsResponseDto } from '../events/dto/response.dto';

@ApiTags('vehicles')
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all vehicles with latest state from Redis' })
  @ApiOkResponse({ description: 'Vehicles list with live state', type: [VehicleResponseDto] })
  findAll() {
    return this.vehiclesService.findAllWithState();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get vehicle details with recent GPS points and events' })
  @ApiOkResponse({ description: 'Vehicle details', type: VehicleDetailsResponseDto })
  findOne(@Param('id') id: string) {
    return this.vehiclesService.findOneWithTelemetry(id);
  }
}
