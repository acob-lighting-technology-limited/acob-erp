ALTER TABLE leave_approvals ADD CONSTRAINT leave_approvals_approver_id_profiles_fkey FOREIGN KEY (approver_id) REFERENCES profiles(id);;
