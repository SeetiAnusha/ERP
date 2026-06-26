'use strict';

/**
 * Migration: Create PostgreSQL Sequences for Registration Number Generation
 *
 * WHY SEQUENCES INSTEAD OF ADVISORY LOCKS + MAX():
 * ─────────────────────────────────────────────────
 * The previous implementation used:
 *   1. pg_advisory_xact_lock → serialises all concurrent requests (bottleneck)
 *   2. SELECT MAX(registration_number) → still two DB round-trips
 *
 * PostgreSQL SEQUENCE gives us:
 *   1. nextval() is a SINGLE atomic operation — lock-free, O(1)
 *   2. Guaranteed unique even under thousands of concurrent calls
 *   3. No application-level locking needed at all
 *   4. The DB engine manages it natively — battle-tested at scale
 *
 * SEQUENCE NAMING CONVENTION:
 *   seq_reg_{prefix_lowercase_sanitised}
 *   e.g. 'CP' → seq_reg_cp, 'INV-' → seq_reg_inv, 'FA-' → seq_reg_fa
 *
 * PREFIXES COVERED (all callers of BaseService.generateRegistrationNumber):
 *   CP    → purchases           (purchaseService)
 *   AP    → accounts_payable    (accountsPayableService)
 *   AR    → accounts_receivable (accountsReceivableService)
 *   BR    → bank_registers      (bankRegisterService, accountsReceivableService)
 *   CJ    → cash_registers      (cashRegisterService)
 *   INV-  → investments         (investmentService)
 *   FA-   → fixed_assets        (fixedAssetService)
 *   AJ    → adjustments         (adjustmentService, type=Adjustment)
 *   ND    → adjustments         (adjustmentService, type=Debit Note)
 *   NC    → adjustments         (adjustmentService, type=Credit Note)
 *
 * INITIAL VALUES:
 *   Each sequence starts from MAX(current highest number) + 1 so existing data
 *   is never overwritten. If the table is empty, the sequence starts at 1.
 *
 * ROLLBACK:
 *   Drops all sequences. Existing data is NOT affected — sequences only affect
 *   future number generation.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔵 Migration: Creating registration number sequences');

    const transaction = await queryInterface.sequelize.transaction();

    try {
      /**
       * Helper: Creates a sequence starting from (current max + 1) for the given
       * table and registration_number prefix. Safe to run multiple times —
       * CREATE SEQUENCE IF NOT EXISTS is idempotent.
       */
      const createSequence = async (seqName, tableName, prefix) => {
        // Find the current highest number for this prefix so we don't duplicate
        const [rows] = await queryInterface.sequelize.query(
          `SELECT MAX(CAST(SUBSTRING(registration_number FROM ${prefix.length + 1}) AS INTEGER)) AS max_num
           FROM ${tableName}
           WHERE registration_number ~ '^${prefix}[0-9]+$'`,
          { transaction }
        );

        // Start from current max + 1, or 1 if table is empty
        const currentMax = rows[0]?.max_num || 0;
        const startVal = currentMax + 1;

        await queryInterface.sequelize.query(
          `CREATE SEQUENCE IF NOT EXISTS ${seqName} START ${startVal} INCREMENT 1 MINVALUE 1 NO MAXVALUE`,
          { transaction }
        );

        console.log(`✅ Sequence ${seqName} created — starts at ${startVal} (current max: ${currentMax})`);
      };

      // ── Create one sequence per prefix ────────────────────────────────────────
      await createSequence('seq_reg_cp',   'purchases',            'CP');
      await createSequence('seq_reg_ap',   'accounts_payable',     'AP');
      await createSequence('seq_reg_ar',   'accounts_receivable',  'AR');
      await createSequence('seq_reg_br',   'bank_registers',       'BR');
      await createSequence('seq_reg_cj',   'cash_register',        'CJ');   // table is singular
      await createSequence('seq_reg_fa',   'fixed_assets',         'FA-');
      await createSequence('seq_reg_aj',   'adjustments',          'AJ');
      await createSequence('seq_reg_nd',   'adjustments',          'ND');
      await createSequence('seq_reg_nc',   'adjustments',          'NC');
      // Note: 'investments' table not yet created — seq_reg_inv skipped until table exists

      await transaction.commit();
      console.log('✅ Migration complete: All registration sequences created');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('🔵 Rollback: Dropping registration number sequences');

    const transaction = await queryInterface.sequelize.transaction();

    try {
      const sequences = [
        'seq_reg_cp', 'seq_reg_ap', 'seq_reg_ar', 'seq_reg_br',
        'seq_reg_cj', 'seq_reg_fa',
        'seq_reg_aj', 'seq_reg_nd', 'seq_reg_nc',
      ];

      for (const seq of sequences) {
        await queryInterface.sequelize.query(
          `DROP SEQUENCE IF EXISTS ${seq}`,
          { transaction }
        );
        console.log(`✅ Dropped sequence ${seq}`);
      }

      await transaction.commit();
      console.log('✅ Rollback complete: All sequences dropped');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};
