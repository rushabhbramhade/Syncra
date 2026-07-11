import { IntegrationProvider, AuthTokens, IntegrationProfile, IntegrationRegistry } from "./provider-base";
import { PLATFORM_MCP_TOOLS, MCPTool } from "@/constants/mcp-tools";

class StubProvider implements IntegrationProvider {
  constructor(
    public id: string,
    public name: string,
    public scopes: string[] = []
  ) {}

  getAuthUrl(_origin: string, _state?: string): string {
    return "#";
  }

  async exchangeCode(_code: string, _origin: string): Promise<AuthTokens> {
    return { accessToken: "mock_token", expiresIn: 3600 };
  }

  async refreshAccess(_refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    return { accessToken: "mock_refreshed_token", expiresIn: 3600 };
  }

  async getProfile(_accessToken: string): Promise<IntegrationProfile> {
    return { email: `connected@${this.id}.com` };
  }

  getTools(): MCPTool[] {
    return PLATFORM_MCP_TOOLS[this.id] || [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async executeTool(_accessToken: string, toolName: string, _args: Record<string, any>): Promise<any> {
    return { success: true, message: `Executed tool ${toolName} for ${this.name} in sandbox mode.` };
  }
}

// Register stubs for remaining platforms to facilitate future scaling
const STUB_IDS = ["slack", "whatsapp", "outlook", "discord", "telegram", "linkedin", "github"];
STUB_IDS.forEach(id => {
  const name = id.charAt(0).toUpperCase() + id.slice(1);
  IntegrationRegistry.register(new StubProvider(id, name));
});
export { StubProvider };
