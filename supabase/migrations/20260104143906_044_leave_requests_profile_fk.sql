ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);;
