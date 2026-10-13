export type CampaignMetadata = { name: string; description: string };

const PREFIX = "viralkit:v1:";

/** Store display metadata in the existing onchain string field. Legacy plain strings remain readable. */
export function encodeCampaignMetadata(metadata: CampaignMetadata): string {
  const name = metadata.name.trim();
  const description = metadata.description.trim();
  if (!name || !description) throw new Error("Enter a campaign name and description.");
  const encoded = `${PREFIX}${JSON.stringify({ name, description })}`;
  if (new TextEncoder().encode(encoded).length > 500)
    throw new Error("Campaign details exceed the contract's 500-byte limit.");
  return encoded;
}

export function decodeCampaignMetadata(value: string): CampaignMetadata {
  if (value.startsWith(PREFIX)) {
    try {
      const parsed = JSON.parse(value.slice(PREFIX.length)) as Partial<CampaignMetadata>;
      if (typeof parsed.name === "string" && typeof parsed.description === "string") return parsed as CampaignMetadata;
    } catch {
      // Fall through to display the original onchain value.
    }
  }
  return { name: value || "Untitled campaign", description: value || "No description provided." };
}
