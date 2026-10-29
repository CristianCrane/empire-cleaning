import { useState } from "react";
import { useLoaderData, useNavigate } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import type { StaffMember, StaffRole } from "@empire-cleaning/models";
import {
  Actions,
  Avatar,
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogTrigger,
  Form,
  Heading,
  List,
  ListItem,
  Notice,
  StatusBadge,
  TextField,
} from "@empire-cleaning/ui";
import { postJson } from "../../api.ts";
import { useAction } from "../action.ts";
import { roleLabel } from "../format.ts";

// everyone on Staff, active first; open one to set their availability or
// deactivate them
export function StaffScreen() {
  const staff = useLoaderData({ from: "/office/staff" });
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading level={1}>Staff</Heading>
        <DialogTrigger>
          <Button>
            <UserPlus aria-hidden size={18} />
            Invite Staff
          </Button>
          <Dialog title="Invite Staff">
            {({ close }) => <InviteForm close={close} />}
          </Dialog>
        </DialogTrigger>
      </div>
      <Card>
        <List
          aria-label="Staff"
          onAction={(id) =>
            navigate({
              to: "/office/staff/$staffId",
              params: { staffId: String(id) },
            })
          }
        >
          {staff.map((member) => (
            <ListItem
              key={member.id}
              id={member.id}
              title={member.name}
              start={<Avatar src={member.imageUrl} />}
              description={[
                member.roles.map((r) => roleLabel[r]).join(" and "),
                member.email,
              ].join(" · ")}
              end={<MemberStatus member={member} />}
            />
          ))}
        </List>
      </Card>
    </div>
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

  const toggle = (role: StaffRole, on: boolean) =>
    setRoles((current) =>
      on ? [...current, role] : current.filter((r) => r !== role),
    );

  const invite = async (form: FormData) => {
    const ok = await action.run(
      () =>
        postJson<StaffMember>("/api/staff", {
          name: form.get("name"),
          email: form.get("email"),
          roles,
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
        We'll email them a link to sign up. Signing up with this email connects
        them to Empire Cleaning's Staff.
      </p>
      <TextField label="Name" name="name" isRequired autoFocus />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="off"
        isRequired
      />
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 font-semibold">Roles</legend>
        <Checkbox
          isSelected={roles.includes("cleaner")}
          onChange={(on) => toggle("cleaner", on)}
        >
          Cleaner: carries out Jobs
        </Checkbox>
        <Checkbox
          isSelected={roles.includes("office_staff")}
          onChange={(on) => toggle("office_staff", on)}
        >
          Office Staff: runs the Office workspace
        </Checkbox>
      </fieldset>
      {action.fieldErrors.roles && (
        <Notice tone="danger">{action.fieldErrors.roles}</Notice>
      )}
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
