import { useState } from "react";
import { formats } from "@empire-cleaning/models";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import { UserPlus, UsersRound } from "lucide-react";
import type { Language, StaffMember, StaffRole } from "@empire-cleaning/models";
import {
  Actions,
  Avatar,
  Button,
  Checkbox,
  Dialog,
  Form,
  LanguagePicker,
  ListPage,
  Notice,
  StatusBadge,
  TextField,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { useAction } from "../action.ts";
import { roleLabel } from "../format.ts";
import { tabShown, useListUrl } from "../list-search.ts";

const { formatList } = formats.en;

// the list's Tabs: who's on Staff now, then who was
export const staffTabs = ["active", "deactivated"] as const;
type StaffTab = (typeof staffTabs)[number];

// Everyone on Staff (#433), a List with a Tab for those deactivated; open
// one to set their availability or deactivate them. Only someone who
// hasn't signed up yet says so: Invited
export function StaffScreen() {
  const staff = useLoaderData({ from: "/office/staff" });
  const url = useListUrl<StaffTab>();
  const navigate = useNavigate();
  const inTab = (tab: StaffTab) =>
    staff.filter((member) => member.active === (tab === "active"));
  const tab = tabShown(staffTabs, url.tab, (t) => inTab(t).length);
  const rolesOf = (member: StaffMember) =>
    formatList(member.roles.map((r) => roleLabel[r]));

  return (
    <ListPage
      title="Staff"
      primary={{
        label: "Invite staff",
        icon: UserPlus,
        dialog: (state) => (
          <Dialog title="Invite staff" {...state}>
            {({ close }) => <InviteForm close={close} />}
          </Dialog>
        ),
      }}
      tabs={[
        {
          id: "active",
          label: "Active",
          count: inTab("active").length,
          none: "No one active on Staff.",
        },
        {
          id: "deactivated",
          label: "Deactivated",
          count: inTab("deactivated").length,
          none: "No one deactivated.",
        },
      ]}
      tab={tab}
      onTabChange={url.onTabChange}
      items={inTab(tab)}
      row={(member) => ({
        id: member.id,
        title: member.name,
        start: <Avatar src={member.imageUrl} />,
        description: `${rolesOf(member)} · ${member.email}`,
        status:
          member.active && member.signedUp
            ? undefined
            : {
                badge: <MemberStatus member={member} />,
                plain: !member.active,
              },
        onOpen: () =>
          void navigate({
            to: "/office/staff/$staffId",
            params: { staffId: member.id },
          }),
      })}
      columns={[
        {
          id: "name",
          label: "Name",
          cell: (member) => (
            <span className="flex items-center gap-3">
              <Avatar src={member.imageUrl} />
              {member.name}
            </span>
          ),
        },
        { id: "roles", label: "Roles", cell: rolesOf },
        {
          id: "email",
          label: "Email",
          from: "lg",
          cell: (member) => (
            <span className="[overflow-wrap:anywhere]">{member.email}</span>
          ),
        },
      ]}
      empty={{ icon: UsersRound, title: "No staff yet" }}
    />
  );
}

export function MemberStatus({ member }: { member: StaffMember }) {
  if (!member.active) return <StatusBadge>Deactivated</StatusBadge>;
  if (!member.signedUp) return <StatusBadge tone="info">Invited</StatusBadge>;
  return null;
}

function InviteForm({ close }: { close: () => void }) {
  const [roles, setRoles] = useState<StaffRole[]>(["cleaner"]);
  const action = useAction("The invitation wasn't sent. Please try again.");

  const invite = async (form: FormData) => {
    const ok = await action.run(
      () =>
        postJson<StaffMember>("/api/staff", {
          name: form.get("name"),
          email: form.get("email"),
          roles,
          preferredLanguage: form.get("preferredLanguage"),
        }),
      (member) => `Invitation sent to ${member.email}`,
    );
    if (ok) close();
  };

  return (
    <Form
      validationErrors={action.fieldErrors}
      onSubmit={(e) => {
        e.preventDefault();
        void invite(new FormData(e.currentTarget));
      }}
    >
      <p className="text-fg-muted">
        We'll email them a link to sign up with this email.
      </p>
      <TextField label="Name" name="name" isRequired autoFocus />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="off"
        isRequired
      />
      <StaffFields
        language="en"
        roles={roles}
        onRolesChange={setRoles}
        errors={action.fieldErrors}
      />
      {action.problem && <Notice tone="danger">{action.problem}</Notice>}
      <Actions>
        <Button variant="quiet" onPress={close}>
          Cancel
        </Button>
        <Button type="submit" isPending={action.isPending}>
          Send invitation
        </Button>
      </Actions>
    </Form>
  );
}

// what an invitation and an edit both set: their roles, and the language
// the Cleaner area and their emails come in (ADR-0025)
export function StaffFields({
  language,
  roles,
  onRolesChange,
  errors,
}: {
  language: Language;
  roles: StaffRole[];
  onRolesChange: (roles: StaffRole[]) => void;
  errors: Record<string, string>;
}) {
  const toggle = (role: StaffRole, on: boolean) =>
    onRolesChange(on ? [...roles, role] : roles.filter((r) => r !== role));

  return (
    <>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 font-semibold">Roles</legend>
        <Checkbox
          isSelected={roles.includes("cleaner")}
          onChange={(on) => toggle("cleaner", on)}
        >
          Cleaner: does the cleaning
        </Checkbox>
        <Checkbox
          isSelected={roles.includes("office_staff")}
          onChange={(on) => toggle("office_staff", on)}
        >
          Office staff: runs the business here
        </Checkbox>
      </fieldset>
      {errors.roles && <Notice tone="danger">{errors.roles}</Notice>}
      <LanguagePicker name="preferredLanguage" defaultValue={language} />
    </>
  );
}
