import { auth } from "@/auth";
import { redirect } from "next/navigation";
import PlannerClient from "./planner-client";

export default async function PlannerPage() {
  const session = await auth();
  if (!session) redirect("/login");
  return <PlannerClient />;
}
