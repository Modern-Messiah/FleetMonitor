import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { EventsQueryDto } from './dto/events-query.dto';
import { EventsListResponseDto } from './dto/response.dto';
import { EventsService } from './events.service';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @ApiOperation({ summary: 'Get events list with filtering and pagination' })
  @ApiOkResponse({ description: 'Events list', type: EventsListResponseDto })
  findMany(@Query() query: EventsQueryDto) {
    return this.eventsService.findMany(query);
  }

  @Get('export/csv')
  @ApiOperation({ summary: 'Export filtered events to CSV' })
  async exportCsv(@Query() query: EventsQueryDto, @Res() response: Response) {
    const csv = await this.eventsService.exportCsv(query);

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="fleet-events-${new Date().toISOString()}.csv"`,
    );

    response.status(200).send(csv);
  }
}
