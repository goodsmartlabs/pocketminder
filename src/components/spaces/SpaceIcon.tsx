import {
  Folder,
  Briefcase,
  User,
  GraduationCap,
  Plane,
  Building,
  Heart,
} from "lucide-react";
export function SpaceIcon({ icon, color }: { icon: string; color: string }) {
  const Icon =
    (
      {
        folder: Folder,
        briefcase: Briefcase,
        user: User,
        "graduation-cap": GraduationCap,
        plane: Plane,
        building: Building,
        heart: Heart,
      } as const
    )[icon as "folder"] ?? Folder;
  return <Icon className="inline size-5" style={{ color }} aria-hidden />;
}
