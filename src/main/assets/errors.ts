// Errors the asset code returns (SPEC 4.1). No message or detail holds a path: details hold
// asset IDs only (SPEC 4.1 [1.7]).
import { AppError } from '../../shared/schemas/result'

export function missingFile(assetIds: string[]): AppError {
  return new AppError('MISSING_FILE', 'A file this project uses cannot be found.', { assetIds })
}

export function assetsFolderMissing(): AppError {
  return new AppError(
    'RULE_VIOLATION',
    'The assets folder could not be found. Choose the assets folder again.',
    { reason: 'assets_folder_missing' },
  )
}

export function assetNotFound(): AppError {
  return new AppError('NOT_FOUND', 'That asset is not in this project.')
}
