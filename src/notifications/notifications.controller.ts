import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly supabase: SupabaseService) {}

  @Post('devices')
  async registerDevice(
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      platform: string;
      provider: string;
      token: string;
      userAgent?: string;
    },
  ) {
    const client = this.supabase.getClient();
    return client
      .from('user_device_tokens')
      .insert({
        user_id: userId,
        platform: body.platform,
        provider: body.provider,
        token: body.token,
        user_agent: body.userAgent ?? null,
      })
      .select('*')
      .single();
  }

  @Get()
  async list(@CurrentUser('id') userId: string, @Query('limit') limit = 20) {
    const client = this.supabase.getClient();
    return client
      .from('notifications')
      .select('*')
      .eq('recipient_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(Number(limit));
  }

  @Post(':id/read')
  async markRead(@CurrentUser('id') userId: string, @Param('id') id: string) {
    const client = this.supabase.getClient();
    return client
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('recipient_user_id', userId);
  }

  @Put('settings')
  async updateSettings(
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      channels?: Record<string, boolean>;
      categories?: Record<string, boolean>;
      quiet_hours?: { start: string; end: string; tz?: string } | null;
    },
  ) {
    const client = this.supabase.getClient();
    return client
      .from('user_notification_settings')
      .upsert({
        user_id: userId,
        channels: body.channels ?? undefined,
        categories: body.categories ?? undefined,
        quiet_hours: body.quiet_hours ?? undefined,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();
  }
}
