import { ActivityLogsRepository } from "#modules/activity-logs/activity-logs.repository";

export class ActivityLogsService {
  constructor() {
    this.repository = new ActivityLogsRepository();
  }

  async getLogs(filters) {
    const { data, total } = await this.repository.findAll(filters);
    
    // Format data for frontend (Vue-like structure)
    const formattedData = data.map(log => {
      const userName = log.user?.employee 
        ? `${log.user.employee.firstName} ${log.user.employee.lastName}`
        : log.user?.username || 'System';
        
      return {
        id: log.id.toString(),
        created: log.createdAt,
        user_name: userName,
        user_role: log.user?.role || 'SYSTEM',
        action: log.action,
        entity_type: log.module,
        description: log.description,
        ip_address: log.ipAddress,
        user_agent: log.userAgent,
        metadata: log.metadata,
        // Map metadata to old_values and new_values if present for Vue compatibility
        old_values: log.metadata?.old || null,
        new_values: log.metadata?.new || null,
        entity_id: log.metadata?.entity_id || null,
        entity_name: log.metadata?.entity_name || null
      };
    });

    return {
      data: formattedData,
      meta: {
        total,
        page: filters.page || 1,
        limit: filters.limit || 100
      }
    };
  }

  async log(data) {
    return this.repository.create(data);
  }
}
