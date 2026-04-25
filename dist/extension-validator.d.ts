/**
 * Install-time validator for GSD extension packages. Called by the install command
 * (Phase 8) before writing files. Not called on bundled extensions — they are
 * discovered at load time, not installed.
 */
export interface ValidationError {
    code: string;
    message: string;
    field?: string;
}
export interface ValidationWarning {
    code: string;
    message: string;
}
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}
export interface ValidationOptions {
    allowGsdNamespace?: boolean;
    extensionId?: string;
}
/**
 * Per D-03: Check that pkg.gsd.extension === true with STRICT equality (not truthiness).
 * Packages without this marker are not recognized as GSD extensions.
 */
export declare function checkInstallDiscriminator(pkg: unknown): ValidationError | null;
/**
 * Per D-04/D-05: Check that the extension ID does not use the reserved gsd.* namespace,
 * unless allowGsdNamespace is explicitly set to true.
 * Per D-06: Only checks extension manifest ID — not pkg.name.
 */
export declare function checkNamespaceReservation(extensionId: string, opts: ValidationOptions): ValidationError | null;
/**
 * Per D-07/D-08/D-09/D-10: Scan both `dependencies` and `devDependencies` for @gsd/* packages.
 * peerDependencies is the correct placement and is NOT flagged.
 * Returns an error per violation naming the exact field and package.
 */
export declare function checkDependencyPlacement(pkg: unknown): ValidationError[];
/**
 * Run all validation checks for a GSD extension package.json.
 * - If opts.extensionId is provided, runs namespace reservation check.
 * - If opts.extensionId is not provided, skips namespace check and adds a warning.
 * - valid is ALWAYS derived as errors.length === 0.
 */
export declare function validateExtensionPackage(pkg: unknown, opts?: ValidationOptions): ValidationResult;
