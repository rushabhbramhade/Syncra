export type { NotificationProvider, FormattedNotification } from "../provider";
export { notificationProviderRegistry } from "../provider-registry";

import "./telegram";
import "./slack";
import "./email";
import "./whatsapp";
import "./push";
import "./discord";