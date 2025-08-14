#!/usr/bin/env node
import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = query => new Promise(resolve => rl.question(query, resolve));

class CSVCleaner {
  constructor() {
    this.foundFiles = [];
    this.deletedFiles = [];
    this.errors = [];
    this.excludePaths = [
      '/System',
      '/Library/Application Support/Apple',
      '/Library/Caches',
      '/private/var',
      '/usr',
      '/opt',
      '/bin',
      '/sbin',
      '/dev',
      '/proc',
      '/tmp',
      '/.Spotlight-V100',
      '/.fseventsd',
      '/.DocumentRevisions-V100',
      '/.Trashes',
      '/Volumes',
      '/cores',
    ];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      info: '\x1b[36m', // Cyan
      success: '\x1b[32m', // Green
      warning: '\x1b[33m', // Yellow
      error: '\x1b[31m', // Red
      reset: '\x1b[0m', // Reset
    };

    console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
  }

  async confirmAction() {
    this.log(
      '⚠️  WARNING: This script will delete all files named "IPTRADECSV2.csv" from your entire MacBook system!',
      'warning'
    );
    this.log('This includes files with this exact name in:', 'warning');
    this.log('- User directories (Documents, Downloads, Desktop, etc.)', 'warning');
    this.log('- Application data directories', 'warning');
    this.log('- Any accessible system locations', 'warning');
    this.log('- Hidden directories', 'warning');
    console.log('');

    const answer = await question(
      'Are you sure you want to delete all "IPTRADECSV2.csv" files? Type "YES DELETE IPTRADECSV2" to confirm: '
    );

    if (answer !== 'YES DELETE IPTRADECSV2') {
      this.log('Operation cancelled by user.', 'info');
      process.exit(0);
    }

    console.log('');
    this.log('Starting CSV cleanup process...', 'info');
  }

  async findCSVFiles() {
    this.log('Searching for IPTRADECSV2.csv files across the entire system...', 'info');

    try {
      // Use mdfind (Spotlight) for faster searching
      this.log('Using Spotlight search for IPTRADECSV2.csv files...', 'info');
      const mdfindCommand = 'mdfind "kMDItemFSName == \'IPTRADECSV2.csv\'"';
      const spotlightFiles = execSync(mdfindCommand, { encoding: 'utf8' })
        .split('\n')
        .filter(line => line.trim())
        .filter(file => file.endsWith('IPTRADECSV2.csv'));

      this.foundFiles = [...this.foundFiles, ...spotlightFiles];
      this.log(`Found ${spotlightFiles.length} IPTRADECSV2.csv files via Spotlight`, 'info');
    } catch (error) {
      this.log('Spotlight search failed, falling back to find command', 'warning');
    }

    // Fallback: Use find command for comprehensive search
    this.log('Performing comprehensive file system search...', 'info');

    const searchPaths = ['/Users', '/Applications', '/Library', '/opt/homebrew', '/usr/local'];

    for (const searchPath of searchPaths) {
      try {
        this.log(`Searching in ${searchPath}...`, 'info');

        // Build exclude arguments for find command
        const excludeArgs = this.excludePaths.map(p => `-path "${p}" -prune -o`).join(' ');

        const findCommand = `find "${searchPath}" ${excludeArgs} -name "IPTRADECSV2.csv" -type f -print 2>/dev/null`;

        const findFiles = execSync(findCommand, {
          encoding: 'utf8',
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        })
          .split('\n')
          .filter(line => line.trim())
          .filter(file => file.endsWith('IPTRADECSV2.csv'));

        this.foundFiles = [...this.foundFiles, ...findFiles];
        this.log(
          `Found ${findFiles.length} additional IPTRADECSV2.csv files in ${searchPath}`,
          'info'
        );
      } catch (error) {
        this.log(`Error searching ${searchPath}: ${error.message}`, 'warning');
      }
    }

    // Remove duplicates
    this.foundFiles = [...new Set(this.foundFiles)];
    this.log(`Total unique IPTRADECSV2.csv files found: ${this.foundFiles.length}`, 'success');

    return this.foundFiles;
  }

  async showFoundFiles() {
    if (this.foundFiles.length === 0) {
      this.log('No IPTRADECSV2.csv files found on the system.', 'info');
      return;
    }

    console.log('\n📁 Found IPTRADECSV2.csv files:');
    console.log('='.repeat(80));

    // Group files by directory for better organization
    const filesByDir = {};
    this.foundFiles.forEach(file => {
      const dir = path.dirname(file);
      if (!filesByDir[dir]) filesByDir[dir] = [];
      filesByDir[dir].push(path.basename(file));
    });

    Object.entries(filesByDir)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([dir, files]) => {
        console.log(`\n📂 ${dir}`);
        files.forEach(file => {
          console.log(`   📄 ${file}`);
        });
      });

    console.log('\n' + '='.repeat(80));
    this.log(`Total: ${this.foundFiles.length} IPTRADECSV2.csv files`, 'info');
  }

  async deleteFiles() {
    if (this.foundFiles.length === 0) {
      this.log('No files to delete.', 'info');
      return;
    }

    this.log(`Starting deletion of ${this.foundFiles.length} IPTRADECSV2.csv files...`, 'info');

    let deleted = 0;
    let skipped = 0;

    for (const file of this.foundFiles) {
      try {
        // Check if file still exists (in case it was already deleted)
        await fs.access(file);

        // Get file stats for logging
        const stats = await fs.stat(file);
        const sizeKB = (stats.size / 1024).toFixed(2);

        // Delete the file
        await fs.unlink(file);

        deleted++;
        this.deletedFiles.push(file);
        this.log(`✅ Deleted: ${file} (${sizeKB} KB)`, 'success');
      } catch (error) {
        if (error.code === 'ENOENT') {
          skipped++;
          this.log(`⏭️  Skipped (already deleted): ${file}`, 'warning');
        } else if (error.code === 'EACCES') {
          this.errors.push({ file, error: 'Permission denied' });
          this.log(`❌ Permission denied: ${file}`, 'error');
        } else {
          this.errors.push({ file, error: error.message });
          this.log(`❌ Error deleting ${file}: ${error.message}`, 'error');
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    this.log(`Deletion completed!`, 'success');
    this.log(`✅ Successfully deleted: ${deleted} files`, 'success');
    if (skipped > 0) this.log(`⏭️  Skipped: ${skipped} files`, 'warning');
    if (this.errors.length > 0) this.log(`❌ Errors: ${this.errors.length} files`, 'error');
  }

  async showSummary() {
    console.log('\n' + '🔍 CLEANUP SUMMARY'.padStart(40, '=').padEnd(80, '='));
    console.log(`📊 Total IPTRADECSV2.csv files found: ${this.foundFiles.length}`);
    console.log(`✅ Successfully deleted: ${this.deletedFiles.length}`);
    console.log(`❌ Errors encountered: ${this.errors.length}`);

    if (this.errors.length > 0) {
      console.log('\n❌ Files that could not be deleted:');
      this.errors.forEach(({ file, error }) => {
        console.log(`   ${file} - ${error}`);
      });
    }

    // Calculate saved space
    if (this.deletedFiles.length > 0) {
      try {
        let totalSize = 0;
        for (const file of this.deletedFiles) {
          // This won't work since files are deleted, but we can estimate
          totalSize += 1024; // Assume average 1KB per CSV for estimation
        }
        const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
        console.log(`💾 Approximate space freed: ${totalSizeMB} MB`);
      } catch (error) {
        // Ignore errors in size calculation
      }
    }

    console.log('='.repeat(80));
    this.log('IPTRADECSV2.csv cleanup completed!', 'success');
  }

  async run() {
    try {
      console.log('🧹 MacBook IPTRADECSV2.csv Cleaner');
      console.log('='.repeat(80));

      await this.confirmAction();
      await this.findCSVFiles();
      await this.showFoundFiles();

      if (this.foundFiles.length > 0) {
        console.log('\n');
        const proceed = await question(
          `Proceed with deleting ${this.foundFiles.length} IPTRADECSV2.csv files? (yes/no): `
        );

        if (proceed.toLowerCase() === 'yes' || proceed.toLowerCase() === 'y') {
          await this.deleteFiles();
        } else {
          this.log('Deletion cancelled by user.', 'info');
        }
      }

      await this.showSummary();
    } catch (error) {
      this.log(`Fatal error: ${error.message}`, 'error');
      console.error(error);
      process.exit(1);
    } finally {
      rl.close();
    }
  }
}

// Run the cleaner
const cleaner = new CSVCleaner();
cleaner.run().catch(console.error);
