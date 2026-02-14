-- Update Lessons Table to Support Multiple Categories
-- Run this in Supabase SQL Editor

-- Step 1: Check current constraint
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'lessons' AND constraint_type = 'CHECK';

-- Step 2: Drop the existing CHECK constraint on category
-- (Replace 'lessons_category_check' with the actual constraint name from Step 1 if different)
ALTER TABLE lessons 
DROP CONSTRAINT IF EXISTS lessons_category_check;

-- Step 3: Verify the constraint is removed
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'lessons' AND constraint_type = 'CHECK';

-- Step 4: Test update with multiple categories (comma-separated)
-- Example: Update a lesson to have multiple categories
-- UPDATE lessons 
-- SET category = '성인개인, 어린이개인' 
-- WHERE id = (SELECT id FROM lessons LIMIT 1);

-- Step 5: Verify the update worked
SELECT id, category, current_session, payment_date
FROM lessons
LIMIT 5;

-- Step 6 (Optional): If you prefer array type instead of comma-separated string
-- Uncomment below to change category column to text array

-- ALTER TABLE lessons 
-- ALTER COLUMN category TYPE text[] USING string_to_array(category, ', ');

-- -- Add CHECK constraint for array version
-- ALTER TABLE lessons
-- ADD CONSTRAINT lessons_category_array_check 
-- CHECK (
--   category <@ ARRAY['성인단체', '성인개인', '어린이개인', '어린이단체']::text[]
-- );

-- Step 7: Create index for better query performance (optional)
CREATE INDEX IF NOT EXISTS idx_lessons_category_gin ON lessons USING gin(category);

-- Notes:
-- - Comma-separated approach is simpler and compatible with existing code
-- - Array approach is more PostgreSQL-native but requires code changes
-- - Current implementation uses comma-separated strings (e.g., "성인개인, 어린이개인")
-- - The frontend handles splitting and joining the values

COMMIT;
