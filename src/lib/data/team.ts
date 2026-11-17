import type { TeamMember } from "@/lib/types";

export const currentUserId = "hina";

export const team: TeamMember[] = [
  { id: "hina", department: "Operations", status: "active", name: "Hina Ahmad", role: "Operator", email: "hina@example.test", capacity: 64, openItems: 9, hue: 222, responsibilities: ["Workflow design", "Escalations", "Quarterly reviews"] },
  { id: "daniel", department: "Customer Support", status: "active", name: "Daniel Reyes", role: "Request Coordinator", email: "daniel@example.test", capacity: 78, openItems: 14, hue: 190, responsibilities: ["Request intake", "Triage", "Requester comms"] },
  { id: "priya", department: "Operations", status: "active", name: "Priya Raman", role: "Senior Reviewer", email: "priya@example.test", capacity: 96, openItems: 17, hue: 268, responsibilities: ["Technical review", "Compliance checks", "Reviewer coaching"] },
  { id: "tomas", department: "Finance", status: "active", name: "Tomás Berg", role: "Finance Approver", email: "tomas@example.test", capacity: 71, openItems: 8, hue: 160, responsibilities: ["Budget approval", "Vendor sign-off"] },
  { id: "ana", department: "Fulfilment", status: "active", name: "Ana Lindqvist", role: "Fulfilment Lead", email: "ana@example.test", capacity: 88, openItems: 12, hue: 28, responsibilities: ["Fulfilment planning", "Supplier coordination", "Delivery tracking"] },
  { id: "kenji", department: "Operations", status: "active", name: "Kenji Watanabe", role: "Automation Engineer", email: "kenji@example.test", capacity: 52, openItems: 5, hue: 240, responsibilities: ["Automation rules", "Data quality", "Integrations roadmap"] },
  { id: "sofia", department: "Operations", status: "active", name: "Sofia Marin", role: "Operations Analyst", email: "sofia@example.test", capacity: 58, openItems: 6, hue: 330, responsibilities: ["Reporting", "SLA monitoring", "Process audits"] },
  { id: "jonah", department: "Fulfilment", status: "away", name: "Jonah Whitfield", role: "Fulfilment Specialist", email: "jonah@example.test", capacity: 83, openItems: 11, hue: 100, responsibilities: ["Order preparation", "Quality checks"] },
];

export const memberById = (id: string): TeamMember =>
  team.find((m) => m.id === id) ?? team[0];

export const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
