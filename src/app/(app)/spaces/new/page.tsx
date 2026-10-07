import { SpaceForm } from "@/components/spaces/SpaceForms";
import { PageHeader } from "@/components/ui/PageHeader";
export default function NewSpace() {
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Create Minder Space"
        subtitle="Everything has a Space."
        back={{ href: "/spaces", label: "Spaces" }}
      />
      <SpaceForm />
    </div>
  );
}
