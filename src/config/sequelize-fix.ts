// This file must be imported BEFORE any models
import { Sequelize, Model, Utils } from 'sequelize';

// Store the original Model.init method
const originalModelInit = Model.init;

// Patch Model.init to handle missing globalOptions.define
(Model as any).init = function(attributes: any, options: any) {
  // Ensure options exist
  if (!options) {
    options = {};
  }

  // If sequelize instance exists
  if (options.sequelize) {
    const sequelizeInstance = options.sequelize as any;
    
    // Ensure globalOptions exists
    if (!sequelizeInstance.globalOptions) {
      sequelizeInstance.globalOptions = {
        define: sequelizeInstance.options?.define || {
          underscored: true,
          freezeTableName: true
        }
      };
    }
    
    // Ensure globalOptions.define exists
    if (!sequelizeInstance.globalOptions.define) {
      sequelizeInstance.globalOptions.define = sequelizeInstance.options?.define || {
        underscored: true,
        freezeTableName: true
      };
    }

    // CRITICAL FIX: Manually merge the define options before calling original init
    const globalDefineOptions = sequelizeInstance.globalOptions.define || {};
    options = (Utils as any).merge(globalDefineOptions, options);
  }

  // Ensure basic options are set as fallback
  if (!options.underscored) options.underscored = true;
  if (!options.freezeTableName) options.freezeTableName = true;

  // Call the original init method
  return originalModelInit.call(this, attributes, options);
};

console.log('✅ Sequelize ts-node compatibility fix applied');

export default true;
