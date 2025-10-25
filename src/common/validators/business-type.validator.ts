import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { isValidBusinessType } from '../enums/business-types.enum';

@ValidatorConstraint({ name: 'isValidBusinessTypeForAccount', async: false })
export class IsValidBusinessTypeForAccountConstraint
  implements ValidatorConstraintInterface
{
  validate(businessType: string, args: ValidationArguments) {
    const [accountTypeProperty] = args.constraints;
    const accountType = (args.object as any)[accountTypeProperty];

    if (!businessType || !accountType) {
      return true; // Let other validators handle required validation
    }

    return isValidBusinessType(accountType, businessType);
  }

  defaultMessage(args: ValidationArguments) {
    const [accountTypeProperty] = args.constraints;
    const accountType = (args.object as any)[accountTypeProperty];
    return `Business type must be valid for account type "${accountType}"`;
  }
}

export function IsValidBusinessTypeForAccount(
  accountTypeProperty: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [accountTypeProperty],
      validator: IsValidBusinessTypeForAccountConstraint,
    });
  };
}
